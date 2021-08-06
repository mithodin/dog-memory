import { AsyncSubject, filter, map, mapTo, merge, Observable, of, ReplaySubject, tap } from 'rxjs';
import type {
    GameActivePlayer,
    GameCardRevealed,
    GameInit,
    GamePairSolved,
    GamePlayerLeft,
    GameRoundEnd,
    GameRoundStart
} from '../game';
import type {
    MemoryGameBoard,
    MemoryGameHeader,
    MemoryGameModal,
    MemoryPlayer,
    PlayerAck,
    PlayerCardSelected,
    PlayerLeave,
    PlayerName,
    PlayerNewRound
} from './';
import { playerAck, playerLeave, playerNewRound } from './';

export class LocalPlayer implements MemoryPlayer {
    private readonly playerLeft$ = new AsyncSubject<void>();
    private readonly playerIndex$ = new ReplaySubject<number>(1);

    constructor(
        private readonly board: MemoryGameBoard,
        private readonly header: MemoryGameHeader,
        private readonly modal: MemoryGameModal
    ) {}

    end(): void {}

    cardRevealed(revealed: GameCardRevealed): Observable<PlayerAck> {
        this.board.revealCard(revealed);
        return of(playerAck());
    }

    cardsHidden(): Observable<PlayerAck> {
        this.board.hideCards();
        return of(playerAck());
    }

    cardsSolved(event: GamePairSolved): Observable<PlayerAck> {
        this.board.pairSolved(event);
        return of(playerAck());
    }

    endRound(event: GameRoundEnd): Observable<PlayerNewRound> {
        return this.modal.getNewRound(event).pipe(
            tap(newRound => {
                if (!newRound) {
                    this.playerLeft$.next();
                    this.playerLeft$.complete();
                }
            }),
            filter(newRound => newRound),
            mapTo(playerNewRound())
        );
    }

    init(event: GameInit): Observable<PlayerName | PlayerLeave> {
        this.header.setNumberOfPlayers(event.numPlayers);
        this.header.setGameCode(event.gameCode);
        event.players.subscribe(player => this.header.setPlayerName(player.name, player.index));
        this.playerIndex$.next(event.playerIndex);
        return merge(
            this.playerLeft$.pipe(mapTo(playerLeave())),
            this.modal.getName(event.playerIndex)
                .pipe(
                    map(name => ({ name }))
                )
        );
    }

    selectCards(): Observable<PlayerCardSelected> {
        return this.board.getCardSelection().pipe();
    }

    startRound(event: GameRoundStart): Observable<PlayerAck> {
        return this.board.setup(event).pipe(
            mapTo(playerAck())
        );
    }

    activePlayer(event: GameActivePlayer): Observable<PlayerAck> {
        this.header.setActivePlayer(event.playerIndex);
        return of(playerAck());
    }

    playerLeft(event: GamePlayerLeft): Observable<PlayerAck> {
        return of(playerAck());
    }
}

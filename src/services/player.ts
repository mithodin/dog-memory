import type { Observable } from 'rxjs';
import type {
    GameActivePlayer,
    GameCardRevealed,
    GameInit,
    GamePairSolved, GamePlayerLeft,
    GameRoundEnd,
    GameRoundStart
} from './game';
import { AsyncSubject, filter, map, mapTo, merge, of, ReplaySubject, Subject, take, tap } from 'rxjs';
import { modalStore } from './modal';
import { getPlayerName } from './query';

export type MemoryPlayerEvent = PlayerName | PlayerAck | PlayerCardSelected | PlayerNewRound | PlayerLeave;

export interface PlayerName {
    name: string;
}

export interface PlayerAck {
    ack: true;
}

function playerAck(): PlayerAck {
    return { ack: true };
}

export interface PlayerCardSelected {
    card: number;
}

export interface PlayerNewRound {
    newRound: true;
}

function playerNewRound(): PlayerNewRound {
    return { newRound: true };
}

export interface PlayerLeave {
    leave: true;
}

function playerLeave(): PlayerLeave {
    return { leave: true };
}

export interface MemoryPlayer {
    readonly init: (event: GameInit) => Observable<PlayerName | PlayerLeave>;
    readonly startRound: (event: GameRoundStart) => Observable<PlayerAck>;
    readonly activePlayer: (event: GameActivePlayer) => Observable<PlayerAck>;
    readonly selectCards: () => Observable<PlayerCardSelected>;
    readonly cardRevealed: (revealed: GameCardRevealed) => Observable<PlayerAck>;
    readonly cardsHidden: () => Observable<PlayerAck>;
    readonly cardsSolved: (event: GamePairSolved) => Observable<PlayerAck>;
    readonly endRound: (event: GameRoundEnd) => Observable<PlayerNewRound>;
    readonly playerLeft: (event: GamePlayerLeft) => Observable<PlayerAck>;
}

export interface MemoryGameHeader {
    setNumberOfPlayers(players: number): void;
    setPlayerName(name: string, index: number): void;
    setActivePlayer(index: number): void;
    setGameCode(code: string): void;
}

export interface MemoryGameBoard {
    setup(event: GameRoundStart): Observable<void>;
    getCardSelection(): Observable<PlayerCardSelected>;
    revealCard(event: GameCardRevealed): void;
    hideCards(): void;
    pairSolved(event: GamePairSolved): void;
}

export interface MemoryGameModal {
    getName(playerIndex: number): Observable<string>;
    getNewRound(event: GameRoundEnd): Observable<boolean>;
}

export class LocalPlayer implements MemoryPlayer {
    private readonly playerLeft$ = new AsyncSubject<void>();
    private readonly playerIndex$ = new ReplaySubject<number>(1);

    constructor(
        private readonly board: MemoryGameBoard,
        private readonly header: MemoryGameHeader,
        private readonly modal: MemoryGameModal
    ) {}

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
            tap( newRound => {
                if( !newRound ){
                    this.playerLeft$.next();
                    this.playerLeft$.complete();
                }
            }),
            filter( newRound => newRound ),
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
                map( name => ({ name }))
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
        console.log(`player ${event.playerIndex} left the game`);
        return of(playerAck());
    }
}

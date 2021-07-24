import type { Observable } from 'rxjs';
import type {
    GameActivePlayer,
    GameCardRevealed,
    GameInit,
    GamePairSolved, GamePlayerLeft,
    GameRoundEnd,
    GameRoundStart
} from './game';
import { AsyncSubject, map, mapTo, merge, of, Subject, take, tap } from 'rxjs';
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
    readonly setNumberOfPlayers: (players: number) => void;
    readonly setPlayerName: (name: string, index: number) => void;
    readonly setActivePlayer: (index: number) => void;
    readonly setGameCode: (code: string) => void;
}

export interface MemoryGameBoard {
    readonly setup: (event: GameRoundStart) => Observable<void>;
    readonly getCardSelection: () => Observable<PlayerCardSelected>;
    readonly revealCard: (event: GameCardRevealed) => void;
    readonly hideCards: () => void;
    readonly pairSolved: (event: GamePairSolved) => void;
}

export class LocalPlayer implements MemoryPlayer {
    private readonly playerLeft$ = new AsyncSubject<void>();
    private readonly playerIndex$ = new Subject<number>();

    constructor(
        private readonly board: MemoryGameBoard,
        private readonly header: MemoryGameHeader
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
        const result$ = new AsyncSubject<void>();
        const message = event.winner ? 'game.over.winner' : 'game.over.draw';
        modalStore.set({
            title: 'game.over.title',
            message: {
                id: message,
                values: {
                    playerName: event.winner.name
                }
            },
            buttons: [
                {
                    label: 'action.newGame',
                    action: () => {
                        result$.next();
                        result$.complete();
                    },
                },
                {
                    label: 'action.close',
                    action: () => {
                        this.playerLeft$.next();
                        this.playerLeft$.complete();
                    },
                }
            ]
        });
        return result$.pipe(
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
            getPlayerName(
                { id: 'query.playerName', values: { playerIndex: (event.playerIndex + 1).toFixed(0) }},
                'action.okay'
            ).pipe(
                map( name => ({ name }))
            )
        );
    }

    selectCards(): Observable<PlayerCardSelected> {
        console.log('trying to get cards');
        return this.board.getCardSelection().pipe(
            tap( ev => console.log('got event', ev)),
            take(2)
        );
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

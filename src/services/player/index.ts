import type { Observable } from 'rxjs';
import type {
    GameActivePlayer,
    GameCardRevealed,
    GameInit,
    GamePairSolved,
    GamePlayerLeft,
    GameRoundEnd,
    GameRoundStart
} from '../game';

export * from './local-player';

export type MemoryPlayerEvent = PlayerName | PlayerAck | PlayerCardSelected | PlayerNewRound | PlayerLeave;

export interface PlayerName {
    name: string;
}

export interface PlayerAck {
    ack: true;
}

export function playerAck(): PlayerAck {
    return { ack: true };
}

export interface PlayerCardSelected {
    card: number;
}

export interface PlayerNewRound {
    newRound: true;
}

export function playerNewRound(): PlayerNewRound {
    return { newRound: true };
}

export interface PlayerLeave {
    leave: true;
}

export function playerLeave(): PlayerLeave {
    return { leave: true };
}

export interface MemoryPlayer {
    init(event: GameInit): Observable<PlayerName | PlayerLeave>;
    startRound(event: GameRoundStart): Observable<PlayerAck>;
    activePlayer(event: GameActivePlayer): Observable<PlayerAck>;
    selectCards(): Observable<PlayerCardSelected>;
    cardRevealed(revealed: GameCardRevealed): Observable<PlayerAck>;
    cardsHidden(): Observable<PlayerAck>;
    cardsSolved(event: GamePairSolved): Observable<PlayerAck>;
    endRound(event: GameRoundEnd): Observable<PlayerNewRound>;
    playerLeft(event: GamePlayerLeft): Observable<PlayerAck>;
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
    getGameCode(): Observable<string>;
}

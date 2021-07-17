import {Updater, Writable, writable} from "svelte/store";
import {DogApi} from "./random-dog";
import {shuffleArray} from "./shuffle";

export interface CardConfig {
    readonly pictureURL: string;
    readonly state: CardState;
    readonly solvedBy?: number;
}

export enum CardState {
    HIDDEN,
    REVEALED,
    SOLVED
}

export interface GameState {
    readonly revealed: ReadonlyArray<number>;
    readonly players: number;
    readonly player: number;
    readonly numSolved: number;
    readonly numPictures: number;
    readonly cards: ReadonlyArray<CardConfig>
}

interface GameStateHandler<STATE,EVENT> {
    readonly state: STATE,
    rules: (ev: EVENT) => GameStateHandler<STATE, any>,
}

class NoCardFlipped implements GameStateHandler<GameState, number> {
    constructor(
        public readonly state: GameState
    ) {}

    rules(ev: number): GameStateHandler<GameState, number> {
        switch( this.state.cards[ev].state ){
            case CardState.HIDDEN:
                return new OneCardFlipped({
                    ...this.state,
                    revealed: [ev],
                    cards: this.state.cards.map((card, index) => index === ev ? {...card, state: CardState.REVEALED} : card)
                });
            default:
                return this;
        }
    }
}

class OneCardFlipped extends NoCardFlipped implements GameStateHandler<GameState, number> {
    rules(ev: number): GameStateHandler<GameState, number | void> {
        switch( this.state.cards[ev].state ){
            case CardState.HIDDEN:
                return new TwoCardsFlipped({
                    ...this.state,
                    revealed: [...this.state.revealed, ev],
                    cards: this.state.cards.map((card, index) => index === ev ? {...card, state: CardState.REVEALED} : card)
                });
            default:
                return this;
        }
    }
}

class TwoCardsFlipped implements GameStateHandler<GameState, void> {
    constructor(
        public readonly state: GameState
    ) {}

    rules(_: void): GameStateHandler<GameState, number> {
        const card1 = this.state.cards[this.state.revealed[0]];
        const card2 = this.state.cards[this.state.revealed[1]];
        if( card1?.pictureURL === card2?.pictureURL ){
            return new NoCardFlipped({
                ...this.state,
                numSolved: this.state.numSolved + 1,
                revealed: [],
                cards: this.state.cards.map( (card, index) => this.state.revealed.includes(index) ? {...card, state: CardState.SOLVED, solvedBy: this.state.player} : card)
            });
        } else {
            return new NoCardFlipped({
                ...this.state,
                player: (this.state.player + 1) % this.state.players,
                revealed: [],
                cards: this.state.cards.map( (card, index) => this.state.revealed.includes(index) ? {...card, state: CardState.HIDDEN} : card)
            });
        }
    }
}

export type MemoryGameStateHandler = GameStateHandler<GameState, number | void>;
export type GameStore = Writable<MemoryGameStateHandler>

const dogApiURL = 'https://random.dog/';
export async function getGameStore(numPictures: number): Promise<GameStore> {
    const dogApi = new DogApi(dogApiURL);
    const pictureURLs = await dogApi.getDogs(numPictures);
    const initialState: GameState = {
        players: 2,
        player: 0,
        numSolved: 0,
        numPictures,
        revealed: [],
        cards: shuffleArray(new Array(2*numPictures).fill(0).map((_,i) => ({
            state: CardState.HIDDEN,
            pictureURL: pictureURLs[i%pictureURLs.length]
        })))
    };
    return writable(new NoCardFlipped(initialState));
}

export function getStoreUpdate(ev: number | void): Updater<MemoryGameStateHandler> {
    return (state) => state.rules(ev);
}
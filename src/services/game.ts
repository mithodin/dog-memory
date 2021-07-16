import {Updater, Writable, writable} from "svelte/store";
import {DogApi} from "./random-dog";
import {shuffleArray} from "./shuffle";

export enum CardState {
    HIDDEN,
    REVEALED,
    SOLVED
}

interface GameState {
    revealed: ReadonlyArray<number>;
    cards: ReadonlyArray<{
        readonly pictureURL: string;
        readonly state: CardState;
    }>
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
                revealed: [],
                cards: this.state.cards.map( (card, index) => this.state.revealed.includes(index) ? {...card, state: CardState.SOLVED} : card)
            });
        } else {
            return new NoCardFlipped({
                revealed: [],
                cards: this.state.cards.map( (card, index) => this.state.revealed.includes(index) ? {...card, state: CardState.HIDDEN} : card)
            });
        }
    }
}

const dogApiURL = 'https://random.dog/';
export async function getGameStore(numPictures: number): Promise<Writable<GameStateHandler<GameState, number | void>>> {
    const dogApi = new DogApi(dogApiURL);
    const pictureURLs = await dogApi.getDogs(numPictures);
    const initialState: GameState = {
        revealed: [],
        cards: shuffleArray(new Array(2*numPictures).fill(0).map((_,i) => ({
            state: CardState.HIDDEN,
            pictureURL: pictureURLs[i%pictureURLs.length]
        })))
    };
    return writable(new NoCardFlipped(initialState));
}

export function getStoreUpdate(ev: number | void): Updater<GameStateHandler<GameState, number | void>> {
    return (state) => state.rules(ev);
}

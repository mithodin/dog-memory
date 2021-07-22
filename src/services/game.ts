import { Writable, writable } from 'svelte/store';
import { DogApi } from './random-dog';
import { shuffleArray } from './shuffle';
import type { BoardSetupEvent } from './remote-session';
import { range } from './utils';
import type { Observable } from 'rxjs';
import { concat, delay, from, map, mapTo, of, startWith, tap } from 'rxjs';

export enum GameMode {
    LOCAL,
    HOST,
    JOIN,
}

export interface CardConfig {
    readonly pictureURL: string;
    readonly state: CardState;
    readonly solvedBy?: number;
}

export enum CardState {
    HIDDEN,
    REVEALED,
    SOLVED,
}

export interface GameState {
    readonly revealed: number | null;
    readonly players: number;
    readonly player: number;
    readonly firstPlayer: number;
    readonly numSolved: number;
    readonly numPictures: number;
    readonly cards: ReadonlyArray<CardConfig>;
    readonly winner?: number;
    readonly loading?: boolean;
}

interface GameStateHandler<STATE, EVENT> {
    readonly state: STATE;
    rules: (ev: EVENT) => Observable<GameStateHandler<STATE, any>>;
}

class NoCardFlipped implements GameStateHandler<GameState, number> {
    constructor(public readonly state: GameState) {}

    rules(ev: number): Observable<GameStateHandler<GameState, number>> {
        switch (this.state.cards[ev].state) {
            case CardState.HIDDEN:
                return of(new OneCardFlipped({
                    ...this.state,
                    revealed: ev,
                    cards: this.state.cards.map((card, index) =>
                        index === ev
                            ? { ...card, state: CardState.REVEALED }
                            : card
                    ),
                }));
            default:
                return of(this);
        }
    }
}

class OneCardFlipped
    extends NoCardFlipped
    implements GameStateHandler<GameState, number>
{
    rules(ev: number): Observable<GameStateHandler<GameState, number | BoardSetupEvent | null>> {
        switch (this.state.cards[ev].state) {
            case CardState.HIDDEN:
                const revealed = [this.state.revealed, ev];
                const card1 = this.state.cards[revealed[0]];
                const card2 = this.state.cards[revealed[1]];
                if (card1?.pictureURL === card2?.pictureURL) {
                    const newState = {
                        ...this.state,
                        numSolved: this.state.numSolved + 1,
                        revealed: null,
                        cards: this.state.cards.map((card, index) =>
                            revealed.includes(index)
                                ? {
                                    ...card,
                                    state: CardState.SOLVED,
                                    solvedBy: this.state.player,
                                }
                                : card
                        ),
                    };
                    if( this.state.numSolved + 1 === this.state.numPictures ){
                       return of(new GameOver(newState));
                    }
                    return of(
                        new NoCardFlipped(newState));
                }
                return concat(
                    of(new TwoCardsFlipped({
                        ...this.state,
                        revealed: null,
                        cards: this.state.cards.map((card, index) =>
                            revealed.includes(index)
                                ? { ...card, state: CardState.REVEALED }
                                : card
                        ),
                    })),
                    of(new NoCardFlipped({
                        ...this.state,
                        player: (this.state.player + 1) % this.state.players,
                        revealed: null,
                        cards: this.state.cards.map((card, index) =>
                            revealed.includes(index)
                                ? { ...card, state: CardState.HIDDEN }
                                : card
                        ),
                    })).pipe(
                        delay(1000)
                    )
                );
            default:
                return of(this);
        }
    }
}

/**
 * Intermediate dummy state. Doesn't react to any events.
 */
class TwoCardsFlipped implements GameStateHandler<GameState, null> {
    constructor(public readonly state: GameState) {}

    rules(_: null): Observable<GameStateHandler<GameState, null>> {
        return of(this);
    }
}

class GameOver implements GameStateHandler<GameState, BoardSetupEvent | null> {
    public readonly state: GameState;

    constructor(state: GameState) {
        let winner = -1;
        const playerPoints = state.cards.reduce((acc, next) => {
            acc[next.solvedBy] += 1;
            return acc;
        }, new Array(state.players).fill(0));
        const max = Math.max(...playerPoints);
        const winners = playerPoints.reduce((winners, points, player) => {
            if( points === max ){
                winners.push(player);
            }
            return winners;
        }, []);
        if( winners.length === 1){
            winner = winners[0];
        }
        this.state = {
            ...state,
            winner
        };
    }

    rules(setup: BoardSetupEvent | null): Observable<GameStateHandler<GameState, number>> {
        return from(getInitialState(this.state.numPictures, (this.state.firstPlayer + 1) % this.state.players, setup)).pipe(
            map( initialState =>
                (new NoCardFlipped({
                   ...initialState.initialState
               }))
            ),
            startWith(new NewGameLoading({
                ...this.state,
                winner: undefined,
                loading: true
            }))
        );
    }
}

class NewGameLoading extends TwoCardsFlipped implements GameStateHandler<GameState, null> {}

export type MemoryGameStateHandler = GameStateHandler<GameState, number | void>;
export type GameStore = Writable<MemoryGameStateHandler>;
export type GameSetup = {
    store: GameStore;
    board: Omit<BoardSetupEvent,'type'>;
};

const dogApiURL = 'https://random.dog/';

async function getInitialState(numPictures: number, firstPlayer: number, boardSetup?: Omit<BoardSetupEvent, 'type'>) {
    const dogApi = new DogApi(dogApiURL);
    let cards: Array<CardConfig> = [];
    if (!boardSetup) {
        const pictureURLs = await dogApi.getDogs(numPictures);
        const indices = shuffleArray(range(2 * numPictures));
        boardSetup = {
            cards: pictureURLs.map((url) => ({
                url,
                indices: [indices.pop(), indices.pop()]
            })),
            firstPlayer
        };
    }
    cards = new Array(2 * numPictures).fill(null);
    await Promise.all(
        boardSetup.cards.map((picture) =>
            dogApi.downloadDog(picture.url).then((localURL) => {
                picture.indices.forEach((index) => {
                    cards[index] = {
                        state: CardState.HIDDEN,
                        pictureURL: localURL
                    };
                });
            })
        )
    );
    const initialState: GameState = {
        players: 2,
        player: boardSetup.firstPlayer,
        firstPlayer: boardSetup.firstPlayer,
        numSolved: 0,
        numPictures,
        revealed: null,
        cards
    };
    return { boardSetup, initialState };
}

export async function getGameStore(
    numPictures: number,
    firstPlayer: number = 0,
    boardSetup?: Omit<BoardSetupEvent,'type'>
): Promise<GameSetup> {
    const setup = await getInitialState(numPictures, firstPlayer, boardSetup);
    return {
        store: writable(new NoCardFlipped(setup.initialState)),
        board: setup.boardSetup,
    };
}

export function handleGameEvent(event: number | void, state: MemoryGameStateHandler, store: GameStore): Observable<void> {
    return state.rules(event).pipe(
        tap(newState => store.set(newState)),
        mapTo(void 0)
    );
}

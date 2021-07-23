import { Writable, writable } from 'svelte/store';
import { DogApi } from './random-dog';
import { shuffleArray } from './shuffle';
import type { BoardSetupEvent, CardLocation } from './remote-session';
import { createArray, range } from './utils';
import type { Observable } from 'rxjs';
import { concat, delay, from, map, of, startWith, switchMap, takeLast, tap } from 'rxjs';
import type { MemoryPlayer } from './player';

export interface GamePlayer {
    readonly index: number;
    readonly name: string;
}

export interface GameInit {
    readonly gameCode: string;
    readonly numPlayers: number;
    readonly players: Observable<GamePlayer>;
    readonly playerIndex: number;
}

export interface GameRoundStart {
    readonly cards: ReadonlyArray<CardLocation>;
}

export interface GameRoundEnd {
    readonly winner: GamePlayer | null;
}

export interface GameCardRevealed {
    readonly card: number;
}

export interface GamePairSolved {
    readonly cards: [number, number];
    readonly solvedBy: string;
}

export interface GameActivePlayer {
    readonly playerIndex: number;
}

export interface GamePlayerLeft {
    readonly playerIndex: number;
}

export abstract class MemoryGame {
    protected readonly gameCode = MemoryGame.getEmojiCode();

    constructor(
        protected readonly players: Array<MemoryPlayer>
    ) {}

    /**
     * Generates an emoji code of length 4, using only animals
     * @param length to keep the probability of collisions below 1/2, the number of active games per second needs to be
     *               below ( 1/2 + sqrt(45**length + 1/4) ) / 1800
     *               length = 3 --> 0.17 games/s
     *               length = 4 --> 1.13 games/s
     *               length = 5 --> 7.55 games/s
     */
    static getEmojiCode(length: number = 4): string {
        const emoji = createArray(length, () => MemoryGame.getAnimalEmoji());
        return emoji.join('');
    }

    private static getAnimalEmoji(): string {
        const firstAnimal = 0x1f400;
        const lastAnimal = 0x1f42c;
        const charCode: number =
            firstAnimal +
            Math.floor(Math.random() * (lastAnimal - firstAnimal + 1));
        return String.fromCodePoint(charCode);
    }

}

// new ^
// legacy v

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
    readonly boardSetup?: Array<CardLocation>;
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
    rules(ev: number): Observable<GameStateHandler<GameState, number | Observable<BoardSetupEvent> | null>> {
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

class GameOver implements GameStateHandler<GameState, Observable<BoardSetupEvent> | null> {
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

    rules(setup: Observable<BoardSetupEvent | null> | null): Observable<GameStateHandler<GameState, number>> {
        if( !setup ){
            setup = from([null]);
        }
        return setup.pipe(
            switchMap(boardSetup =>
                from(getInitialState(this.state.numPictures, (this.state.firstPlayer + 1) % this.state.players, boardSetup))
            ),
            map( initialState =>
                (new NoCardFlipped({
                    ...initialState.initialState,
                    boardSetup: initialState.boardSetup.cards
                }))
            ),
            startWith(new NewGameLoading({
                ...this.state,
            })),
        );
    }
}

class NewGameLoading extends TwoCardsFlipped implements GameStateHandler<GameState, null> {
    public readonly state: GameState;

    constructor(state: GameState) {
        super(state);
        this.state = {
            ...state,
            loading: true,
            winner: undefined
        }
    }
}

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

export function handleGameEvent(event: number | void, state: MemoryGameStateHandler, store: GameStore): Observable<MemoryGameStateHandler> {
    return state.rules(event).pipe(
        tap(newState => store.set(newState)),
        takeLast(1) // discard intermediate states
    );
}

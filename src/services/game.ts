import { Writable, writable } from 'svelte/store';
import { DogApi } from './random-dog';
import { shuffleArray } from './shuffle';
import type { BoardSetupEvent, CardLocation } from './remote-session';
import { createArray, range } from './utils';
import type { ObservableResponse } from './utils';
import type { Observable } from 'rxjs';
import {
    AsyncSubject,
    concat,
    delay, filter,
    from,
    map, mapTo,
    merge,
    of, reduce,
    ReplaySubject,
    startWith,
    switchMap, take,
    takeLast,
    tap, toArray
} from 'rxjs';
import type { MemoryPlayer, PlayerCardSelected, PlayerLeave, PlayerName } from './player';

export type MemoryGameEvent = GamePlayer | GameInit | GameRoundStart | GameRoundEnd | GameCardRevealed | GamePairSolved | GameActivePlayer | GamePlayerLeft | void;

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

interface PlayerResponse<Event> {
    playerIndex: number;
    event: Event;
}

export class MemoryGame {
    private readonly numPlayers: number;
    private readonly gameCode = MemoryGame.getEmojiCode();
    private cardConfig: Array<CardConfig> = null;

    constructor(
        private readonly players: Array<MemoryPlayer>,
        private readonly numPictures: number = 2
    ) {
        this.numPlayers = players.length;
    }

    public run(): Observable<void> {
        return this.init()
            .pipe(
                switchMap(() => this.startNewRound())
            );
    }

    private toAll<Method extends keyof MemoryPlayer>
    (event: Parameters<MemoryPlayer[Method]>[0], method: Method, individualize: (player: MemoryPlayer, index: number, event: Parameters<MemoryPlayer[Method]>[0]) => Parameters<MemoryPlayer[Method]>[0] = (p,i,ev) => ev): Observable<PlayerResponse<ObservableResponse<MemoryPlayer[Method]>>> {
        const responses = this.players.map((player, index) => {
            let payload = individualize(player, index, event);
            let call: (ev: Parameters<MemoryPlayer[Method]>[0]) => Observable<ObservableResponse<MemoryPlayer[Method]>> = player[method] as any; // it's fine
            call = call.bind(player);
            return call(payload).pipe(
                map( response => ({
                    playerIndex: index,
                    event: response
                })),
                take(1)
            );
        });
        return merge(...responses);
    }

    private init(): Observable<void> {
        const allReady = new AsyncSubject<null>();
        const nameSubject = new ReplaySubject<GamePlayer>();
        const init: GameInit = {
            gameCode: this.gameCode,
            numPlayers: this.numPlayers,
            playerIndex: -1,
            players: nameSubject.asObservable()
        };
        const playerResponses = this.toAll(
                init,
                'init',
                (_, i, ev) => ({ ...ev, playerIndex: i})
            );

        playerResponses.pipe(
            filter<PlayerResponse<PlayerLeave>>(response => response.event.hasOwnProperty('leave'))
        ).subscribe( leave => {
            this.toAll({ playerIndex: leave.playerIndex }, 'playerLeft').subscribe({}); //don't actually care about the responses here
        });

        playerResponses
            .pipe(
                filter<PlayerResponse<PlayerName>>(response => response.event.hasOwnProperty('name'))
            )
            .subscribe(
            {
                next: response => nameSubject.next({
                    index: response.playerIndex,
                    name: response.event.name
                }),
                complete: () => {
                    allReady.next(null);
                    allReady.complete();
                }
            }
        )
        return allReady.asObservable();
    }

    private startNewRound(): Observable<void> {
        const dogApi = new DogApi(dogApiURL);
        return from(dogApi.getDogs(this.numPictures)).pipe(
            map<Array<string>,Array<CardLocation>>( pictureURLs => {
                const indices = shuffleArray(range(2 * this.numPictures));
                return pictureURLs.map((url) => ({
                    url,
                    indices: [indices.pop(), indices.pop()]
                }));
            }),
            tap( cards => {
               MemoryGame.cardLocationToCardConfig(cards, false).subscribe(cardConfig => {
                   this.cardConfig = cardConfig;
               });
            }),
            switchMap( cards => this.toAll({ cards }, 'startRound')),
            toArray(),
            switchMap( () =>
                this.getCardsFrom(1)
            ),
            switchMap( selected =>
                this.toAll({ ...selected }, 'cardRevealed')
            ),
            mapTo(null)
        )
    }

    private getCardsFrom(player: number): Observable<PlayerCardSelected> {
        return this.toAll({ playerIndex: player }, 'activePlayer').pipe(
            toArray(),
            switchMap( () => this.players[player].selectCards())
        )
    }

    static cardLocationToCardConfig(cardLocations: ReadonlyArray<CardLocation>, download: boolean): Observable<Array<CardConfig>> {
        const numCards = cardLocations.length * 2;
        const dogApi = new DogApi(dogApiURL);
        return merge(
            ...cardLocations.map(card =>
                (download ? from(dogApi.downloadDog(card.url)): of(card.url)).pipe(
                    map(url => ({
                        url,
                        indices: card.indices
                    }))
                )
            )
        ).pipe(
            reduce((cards, location) => {
                    location.indices.forEach((index) => cards[index] = {
                        state: CardState.HIDDEN,
                        pictureURL: location.url
                    });
                    return cards;
                },
                createArray(numCards, () => null)
            )
        )
    }

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

// new ^
// legacy v

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

interface GameStateHandler<STATE, EVENT, NEW_STATE extends GameStateHandler<STATE, any, any> = GameStateHandler<STATE, any, any>> {
    readonly state: STATE;
    rules: (ev: EVENT) => Observable<NEW_STATE>;
}

class NoCardFlipped implements GameStateHandler<GameState, number, NoCardFlipped | OneCardFlipped> {
    constructor(public readonly state: GameState) {}

    rules(ev: number): Observable<NoCardFlipped | OneCardFlipped> {
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

class OneCardFlipped implements GameStateHandler<GameState, number, NoCardFlipped | OneCardFlipped | TwoCardsFlipped | GameOver>
{
    constructor(public readonly state: GameState) {}

    rules(ev: number): Observable<NoCardFlipped | OneCardFlipped | TwoCardsFlipped | GameOver> {
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
                    return of(new NoCardFlipped(newState));
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
class TwoCardsFlipped implements GameStateHandler<GameState, TwoCardsFlipped> {
    constructor(public readonly state: GameState) {}

    rules(_: null): Observable<TwoCardsFlipped> {
        return of(this);
    }
}

class GameOver implements GameStateHandler<GameState, Observable<BoardSetupEvent> | null, NoCardFlipped | NewGameLoading> {
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

    rules(setup: Observable<BoardSetupEvent | null> | null): Observable<NoCardFlipped | NewGameLoading> {
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

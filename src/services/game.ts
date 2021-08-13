import { DogApi } from './random-dog';
import { shuffleArray } from './shuffle';
import type { ObservableResponse } from '../utils/utils';
import { createArray, range } from '../utils/utils';
import type { Observable } from 'rxjs';
import {
    AsyncSubject, concatMap,
    delay,
    EMPTY,
    filter,
    from,
    last,
    map,
    mapTo,
    merge,
    of,
    reduce,
    ReplaySubject,
    startWith,
    Subject,
    switchMap,
    take,
    takeUntil,
    tap,
    toArray
} from 'rxjs';
import type { MemoryPlayer, PlayerCardSelected, PlayerLeave, PlayerName } from './player';

const dogApiURL = 'https://random.dog/';

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

export interface CardLocation {
    url: string;
    indices: [number, number];
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
    readonly solvedBy: number;
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

interface TurnOver {
    over: boolean;
}

export interface MemoryGame {
    run(): Observable<void>;
}

export class LocalGame implements MemoryGame {
    private readonly numPlayers: number;
    private readonly playerNames: Array<string>;
    private readonly gameCode = LocalGame.getEmojiCode();

    constructor(
        private readonly players: Array<MemoryPlayer>,
        private readonly numPictures: number = 2
    ) {
        this.numPlayers = players.length;
        this.playerNames = new Array<string>(this.numPlayers).fill(null);
    }

    public run(): Observable<void> {
        let firstPlayer = Math.floor(Math.random()*this.numPlayers);
        const newRound: Subject<void> = new Subject<void>();
        return this.init()
            .pipe(
                switchMap(() => newRound.pipe(
                    startWith(null),
                    map( (_,i) => (firstPlayer + i)%this.numPlayers)
                )),
                switchMap((startPlayer) => this.startNewRound(startPlayer)),
                switchMap( (roundResult) => this.roundEnd(roundResult)),
                tap( startNewRound => {
                    if(startNewRound){
                        newRound.next();
                    } else {
                        newRound.complete();
                    }
                }),
                filter( (newRound) => !newRound),
                mapTo(null),
                tap(() => this.toAll(null, 'end'))
            );
    }

    private toAll<Method extends keyof MemoryPlayer>
    (event: Parameters<MemoryPlayer[Method]>[0], method: Method, individualize: (player: MemoryPlayer, index: number, event: Parameters<MemoryPlayer[Method]>[0]) => Parameters<MemoryPlayer[Method]>[0] = (p,i,ev) => ev): Observable<PlayerResponse<ObservableResponse<MemoryPlayer[Method]>>> {
        const responses = this.players.map((player, index) => {
            let payload = individualize(player, index, event);
            let call: (ev: Parameters<MemoryPlayer[Method]>[0]) => Observable<ObservableResponse<MemoryPlayer[Method]>> = player[method] as any; // it's fine
            call = call.bind(player);
            return call(payload)?.pipe(
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
            this.toAll({ playerIndex: leave.playerIndex }, 'playerLeft').subscribe(); //don't actually care about the responses here
        });

        playerResponses
            .pipe(
                filter<PlayerResponse<PlayerName>>(response => response.event.hasOwnProperty('name')),
                tap( response => {
                    this.playerNames[response.playerIndex] = response.event.name;
                })
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

    private startNewRound(firstPlayer: number): Observable<{ winner?: number }> {
        const dogApi = new DogApi(dogApiURL);
        let cardConfiguration: Array<CardConfig> = null;
        return dogApi.getDogs(this.numPictures).pipe(
            map<Array<string>,Array<CardLocation>>( pictureURLs => {
                const indices = shuffleArray(range(2 * this.numPictures));
                return pictureURLs.map((url) => ({
                    url,
                    indices: [indices.pop(), indices.pop()]
                }));
            }),
            tap( cards => {
               LocalGame.cardLocationToCardConfig(cards, false).subscribe(cardConfig => {
                   cardConfiguration = cardConfig;
               });
            }),
            switchMap( cards => this.toAll({ cards }, 'startRound')),
            toArray(),
            switchMap( () =>
               this.runGameRound(cardConfiguration, firstPlayer)
            )
        )
    }

    private runGameRound(cards: Array<CardConfig>, firstPlayer: number): Observable<{ winner?: number }> {
        const turns: Subject<void> = new Subject<void>();
        return turns.pipe(
            startWith(null),
            map((_,i) => (firstPlayer + i) % this.numPlayers ),
            switchMap( activePlayer => this.runTurn(activePlayer, cards)),
            map( () => {
                const gameOver = this.allCardsSolved(cards);
                if( gameOver ){
                    turns.complete();

                    const points = this.getPlayerPoints(cards);
                    const max = Math.max(...points);
                    const winners = points.reduce((winners, points, index) => {
                        if( points === max ){
                            winners.push(index);
                        }
                        return winners;
                    }, []);
                    if( winners.length === 1 ){
                        return { winner: winners[0] };
                    } else {
                        return {}
                    }
                } else {
                    turns.next();
                    return {}
                }
            }),
            last(),
        )
    }

    private getPlayerPoints(cards: Array<CardConfig>) {
        return cards.reduce((points, card) => {
            points[card.solvedBy] += 1;
            return points;
        }, new Array(this.numPlayers).fill(0));
    }

    private allCardsSolved(cards: Array<CardConfig>) {
        return cards.filter(card => card.state === CardState.SOLVED).length === cards.length;
    }

    private runTurn(activePlayer: number, cards: Array<CardConfig>): Observable<TurnOver> {
        let selectedIndices: Array<number> = [];
        const turnOver$: AsyncSubject<void> = new AsyncSubject<void>();
        return this.getCardsFrom(activePlayer).pipe(
            takeUntil(turnOver$),
            concatMap(selected => {
               return of(selected).pipe(
                   takeUntil(turnOver$),
                   filter(selected => cards[selected.card].state === CardState.HIDDEN),
                   tap(selected => {
                       cards[selected.card].state = CardState.REVEALED;
                       selectedIndices.push(selected.card);
                   }),
                   switchMap( selected => this.toAll({ card: selected.card }, 'cardRevealed').pipe(toArray())),
                   switchMap( () => {
                       if( selectedIndices.length === 1 ){
                           return EMPTY;
                       }
                       if( selectedIndices.length === 2 ){
                           const selectedCards = selectedIndices.map(sel => cards[sel]);
                           if( selectedCards[0].pictureURL === selectedCards[1].pictureURL ){
                               selectedCards[0].state = CardState.SOLVED;
                               selectedCards[1].state = CardState.SOLVED;
                               selectedCards[0].solvedBy = activePlayer;
                               selectedCards[1].solvedBy = activePlayer;
                               const turnOver = this.allCardsSolved(cards);
                               return this.toAll({ cards: selectedIndices as [number, number], solvedBy: activePlayer }, 'cardsSolved').pipe(toArray(),mapTo({ over: turnOver}))
                           } else {
                               selectedCards[0].state = CardState.HIDDEN;
                               selectedCards[1].state = CardState.HIDDEN;
                               return of(null).pipe(
                                   delay(1500),
                                   switchMap(() => this.toAll(undefined, 'cardsHidden').pipe(toArray(), mapTo({ over: true })))
                               );
                           }
                       }
                       return EMPTY;
                   }),
                   tap((turnOver) => {
                       selectedIndices = [];
                       if( turnOver.over ){
                           turnOver$.next();
                           turnOver$.complete();
                       }
                   }),
               )
            }),
            filter( turnOver => turnOver.over )
        );
    }

    private roundEnd(result: {winner?: number}): Observable<boolean> {
        const event = result.hasOwnProperty('winner') ? { winner: { index: result.winner, name: this.playerNames[result.winner] } } : { winner: null };
        return this.toAll(event, 'endRound').pipe(
            toArray(),
            map( responses => responses.length === this.numPlayers )
        );
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
        const emoji = createArray(length, () => LocalGame.getAnimalEmoji());
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
    KI
}

export interface CardConfig {
    readonly pictureURL: string;
    state: CardState;
    solvedBy?: number;
}

export enum CardState {
    HIDDEN,
    REVEALED,
    SOLVED,
}

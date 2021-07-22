import { createArray } from './utils';
import type { Observable } from 'rxjs';
import { BehaviorSubject, filter, ReplaySubject, take } from 'rxjs';
import Peer, { DataConnection } from 'peerjs';

interface GameEventCommon<T extends string> {
    type: T;
}

export type GameEvent =
    | CardClickedEvent
    | BoardSetupEvent
    | GuestHelloEvent
    | HostHelloEvent
    | ReadyEvent
    | PlayerLeftEvent
    | NewGameEvent
    | CloseGameEvent;

export interface CardClickedEvent extends GameEventCommon<'CARD_CLICKED'> {
    card: number;
}

export function cardClicked(which: number): CardClickedEvent {
    return {
        type: 'CARD_CLICKED',
        card: which,
    };
}

export interface CardLocation {
    url: string;
    indices: [number, number];
}

export interface BoardSetupEvent extends GameEventCommon<'BOARD_SETUP'> {
    cards: Array<CardLocation>;
    firstPlayer: number;
}

export function boardSetup(board: Omit<BoardSetupEvent,'type'>): BoardSetupEvent {
    return {
        type: 'BOARD_SETUP',
        ...board
    };
}

export interface GuestHelloEvent extends GameEventCommon<'GUEST_HELLO'> {
    name: string;
}

export function guestHello(name: string): GuestHelloEvent {
    return {
        type: 'GUEST_HELLO',
        name,
    };
}

export interface HostHelloEvent extends GameEventCommon<'HOST_HELLO'> {
    name: string;
}

export function hostHello(name: string): HostHelloEvent {
    return {
        type: 'HOST_HELLO',
        name,
    };
}

export type ReadyEvent = GameEventCommon<'READY'>;

export function ready(): ReadyEvent {
    return { type: 'READY' };
}

export type NewGameEvent = GameEventCommon<'NEW_GAME'>;

export function newGame(): NewGameEvent {
    return { type: 'NEW_GAME' };
}

export type CloseGameEvent = GameEventCommon<'CLOSE_GAME'>;

export function closeGame(): CloseGameEvent {
    return { type: 'CLOSE_GAME' };
}

export type PlayerLeftEvent = GameEventCommon<'PLAYER_LEFT'>;

export function playerLeft(): PlayerLeftEvent {
    return { type: 'PLAYER_LEFT' };
}

export abstract class RemoteSession {
    private readonly fakeTime$: BehaviorSubject<number> = new BehaviorSubject<number>(0);
    protected readonly connection$ = new ReplaySubject<DataConnection>(1);
    protected readonly events = new ReplaySubject<GameEvent>(Infinity, 0, { now: () => this.fakeTime$.getValue() });
    public readonly remoteEvents: Observable<GameEvent> =
        this.events.asObservable();

    protected constructor() {
        this.connection$.subscribe( (connection) => {
            connection.on('close', () => this.events.next(playerLeft()));
        });
    }

    public send(event: GameEvent): void {
        this.connection$.subscribe((connection) => {
            connection.send(event);
        });
    }

    public close(): void {
        this.connection$.subscribe((connection) => {
            this.events.complete();
            connection.close();
        });
    }

    public reset(): void {
        this.fakeTime$.next(this.fakeTime$.getValue() + 1);
    }

    public getNext<T extends GameEvent>(type: T["type"]): Observable<T> {
        return this.getEventType(type).pipe(
            take(1)
        );
    }

    public getEventType<T extends GameEvent>(type: T["type"]): Observable<T> {
        return this.remoteEvents.pipe(
            filter<T>((event) => event.type === type),
        );
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
        const emoji = createArray(length, () => RemoteSession.getAnimalEmoji());
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

    static getHostKey(emojiCode: string) {
        const key = `host@${emojiCode}@memory.deadcrab.de`;
        return RemoteSession.hashKey(key);
    }

    static getGuestKey(emojiCode: string) {
        const key = `guest@${emojiCode}@memory.deadcrab.de`;
        return RemoteSession.hashKey(key);
    }

    private static hashKey(key: string): Promise<string> {
        const encoder = new TextEncoder();
        return window.crypto.subtle
            .digest('SHA-256', encoder.encode(key))
            .then((hash) => {
                const hashArray = Array.from(new Uint8Array(hash));
                return hashArray
                    .map((byte) => byte.toString(16).padStart(2, '0'))
                    .join('');
            });
    }
}

export class RemoteSessionHost extends RemoteSession {
    constructor(
        private readonly gameCode: string = RemoteSession.getEmojiCode(),
        peer: Peer = null
    ) {
        super();
        let peerPromise = Promise.resolve(peer);
        if (!peer) {
            peerPromise = RemoteSession.getHostKey(gameCode).then(
                (hostKey) => new Peer(hostKey)
            );
        }
        peerPromise.then((resolvedPeer) => {
            resolvedPeer.on('connection', (connection) => {
                connection.on('data', (data) => this.events.next(data));
                connection.on('open', () => {
                    this.connection$.next(connection);
                });
            });
        });
    }
}

export class RemoteSessionClient extends RemoteSession {
    constructor(
        private readonly gameCode: string = RemoteSession.getEmojiCode(),
        peer: Peer = null
    ) {
        super();
        let peerPromise = Promise.resolve(peer);
        if (!peer) {
            peerPromise = RemoteSession.getGuestKey(gameCode).then(
                (hostKey) => new Peer(hostKey)
            );
        }
        Promise.all([peerPromise, RemoteSession.getHostKey(gameCode)]).then(
            ([resolvedPeer, hostKey]) => {
                resolvedPeer.on('open', () => {
                    const connection = resolvedPeer.connect(hostKey);
                    connection.on('data', (data) => this.events.next(data));
                    connection.on('open', () => {
                        this.connection$.next(connection);
                    });
                });
            }
        );
    }
}

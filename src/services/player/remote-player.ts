import { v4 as uuidv4 } from 'uuid';
import type { MemoryPlayer, PlayerAck, PlayerCardSelected, PlayerLeave, PlayerName, PlayerNewRound } from './index';
import type {
    GameActivePlayer,
    GameCardRevealed,
    GameInit,
    GamePairSolved,
    GamePlayerLeft,
    GameRoundEnd, GameRoundStart
} from '../game';
import type { Observable } from 'rxjs';
import { catchError, EMPTY, filter, from, map, of, ReplaySubject, Subject, switchMap, take } from 'rxjs';
import Peer, { DataConnection } from 'peerjs';
import { playerLeave } from './index';

export type RemoteEvent<PAYLOAD extends Record<string, any>,TAG extends string> = GenericEvent & PAYLOAD & { type: TAG, uuid: string };

export type RemoteActivePlayer = RemoteEvent<GameActivePlayer, 'ACTIVE_PLAYER'>;
export type RemoteCardRevealed = RemoteEvent<GameCardRevealed, 'CARD_REVEALED'>;
export type RemoteCardsHidden = RemoteEvent<{}, 'CARDS_HIDDEN'>;
export type RemoteCardsSolved = RemoteEvent<GamePairSolved, 'PAIR_SOLVED'>;
export type RemoteRoundEnd = RemoteEvent<GameRoundEnd, 'ROUND_END'>;
export type RemoteGameInit = RemoteEvent<GameInit, 'GAME_INIT'>;
export type RemotePlayerLeft = RemoteEvent<GamePlayerLeft, 'PLAYER_LEFT'>;
export type RemoteSelectCards = RemoteEvent<{}, 'SELECT_CARDS'>;
export type RemoteRoundStart = RemoteEvent<GameRoundStart, 'ROUND_START'>;
export type RemoteAck = RemoteEvent<PlayerAck, 'ACK'>;
export type RemoteNewRound = RemoteEvent<PlayerNewRound, 'NEW_ROUND'>;
export type RemoteName = RemoteEvent<PlayerName, 'NAME'>;
export type RemoteCardSelected = RemoteEvent<PlayerCardSelected, 'CARD_SELECTED'>;

export type RemoteMemoryQuery =
    | RemoteActivePlayer
    | RemoteCardRevealed
    | RemoteCardsHidden
    | RemoteCardsSolved
    | RemoteRoundEnd
    | RemoteGameInit
    | RemotePlayerLeft
    | RemoteSelectCards
    | RemoteRoundStart;

export type RemoteMemoryResponse =
    | RemoteAck
    | RemoteNewRound
    | RemoteName
    | RemoteCardSelected;

const QueryResponseMapping = {
    CARDS_HIDDEN: 'ACK',
    CARD_REVEALED: 'ACK',
    GAME_INIT: 'NAME',
    PAIR_SOLVED: 'ACK',
    PLAYER_LEFT: 'ACK',
    ROUND_END: 'NEW_ROUND',
    ROUND_START: 'ACK',
    ACTIVE_PLAYER: 'ACK',
    SELECT_CARDS: 'CARD_SELECTED'
} as const;

type TagToType = {[T in RemoteMemoryEvent as T['type']]: T};

export type RemoteMemoryResponseTo<QUERY extends RemoteMemoryQuery> = TagToType[typeof QueryResponseMapping[QUERY['type']]]

export type RemoteMemoryEvent = RemoteMemoryQuery | RemoteMemoryResponse

export class RemotePlayer implements MemoryPlayer {
    private session$: ReplaySubject<PeerjsSession<RemoteMemoryEvent>> = new ReplaySubject(1);

    activePlayer(event: GameActivePlayer): Observable<PlayerAck> {
        return undefined;
    }

    cardRevealed(revealed: GameCardRevealed): Observable<PlayerAck> {
        return undefined;
    }

    cardsHidden(): Observable<PlayerAck> {
        return undefined;
    }

    cardsSolved(event: GamePairSolved): Observable<PlayerAck> {
        return undefined;
    }

    endRound(event: GameRoundEnd): Observable<PlayerNewRound> {
        return undefined;
    }

    init(event: GameInit): Observable<PlayerName | PlayerLeave> {
        const response$ = new Subject<PlayerName | PlayerLeave>();
        PeerjsSession.getHostKey(event.gameCode, event.playerIndex).pipe(
            switchMap(hostKey => {
                this.session$.next(new PeerjsSession(hostKey));
                return this.session$
            }),
        ).subscribe( session => {
            session.events$.subscribe({
                error: () => {
                    response$.next(playerLeave());
                }
            });
            this.query(this.makeEvent<RemoteGameInit>(event,'GAME_INIT')).subscribe(response$);
        });
        return response$;
    }

    playerLeft(event: GamePlayerLeft): Observable<PlayerAck> {
        return undefined;
    }

    selectCards(): Observable<PlayerCardSelected> {
        return undefined;
    }

    startRound(event: GameRoundStart): Observable<PlayerAck> {
        return undefined;
    }

    private query<QUERY extends RemoteMemoryQuery>(query: QUERY): Observable<RemoteMemoryResponseTo<QUERY>> {
        return this.session$.pipe(
            take(1),
            switchMap( session => {
                const answer$ = session.events$.pipe(
                    catchError(() => EMPTY),
                    filter<RemoteMemoryResponseTo<QUERY>>( event => event.uuid === query.uuid)
                );
                session.send(query);
                return answer$
            })
        );
    }

    private makeEvent<QUERY extends RemoteMemoryQuery>(query: Omit<QUERY,'uuid' | 'type'>, type: QUERY['type']): QUERY {
        return {
            ...query,
            type,
            uuid: uuidv4()
        } as QUERY;
    }
}

export interface GenericEvent {
    type: string;
}

export const CONNECTION_CLOSED = 'CONNECTION_CLOSED';

class PeerjsSession<EVENTS extends GenericEvent> {
    private readonly connection$ = new ReplaySubject<DataConnection>(1);
    private readonly events = new Subject<EVENTS>();
    public readonly events$ = this.events.asObservable();

    static getHostKey(emojiCode: string, index: number): Observable<string> {
        const key = `host${index}@${emojiCode}@memory.deadcrab.de`;
        return PeerjsSession.hashKey(key);
    }

    static getGuestKey(emojiCode: string, index: number): Observable<string> {
        const key = `guest${index}@${emojiCode}@memory.deadcrab.de`;
        return PeerjsSession.hashKey(key);
    }

    private static hashKey(key: string): Observable<string> {
        const encoder = new TextEncoder();
        return from(window.crypto.subtle.digest('SHA-256', encoder.encode(key)))
            .pipe(
                map((hash) => {
                    const hashArray = Array.from(new Uint8Array(hash));
                    return hashArray
                        .map((byte) => byte.toString(16).padStart(2, '0'))
                        .join('');
                })
            );
    }

    constructor(myKey: string, remoteKey?: string) {
        this.connection$.subscribe( (connection) => {
            connection.on('close', () => this.events.error(CONNECTION_CLOSED));
            connection.on('data', (data) => this.events.next(data));
        });
        const peer = new Peer(myKey);
        peer.on('open', () => {
            if( remoteKey ) {
                const connection = peer.connect(remoteKey, { reliable: true });
                connection.on('open', () => {
                    this.connection$.next(connection);
                })
            } else {
                peer.on('connection', (connection) => {
                    connection.on('open', () => {
                        this.connection$.next(connection);
                    });
                })
            }
        });
    }

    public send(event: EVENTS): void {
        this.connection$.pipe(take(1)).subscribe( connection => {
            connection.send(event);
        });
    }
}

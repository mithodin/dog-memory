import { v4 as uuidv4 } from 'uuid';
import type { MemoryPlayer, PlayerAck, PlayerCardSelected, PlayerLeave, PlayerName, PlayerNewRound } from './index';
import { playerLeave } from './index';
import type {
    GameActivePlayer,
    GameCardRevealed,
    GameInit,
    GamePairSolved,
    GamePlayerLeft,
    GameRoundEnd,
    GameRoundStart
} from '../game';
import type { Observable } from 'rxjs';
import { catchError, EMPTY, filter, first, ReplaySubject, Subject, switchMap, take } from 'rxjs';
import { GenericEvent, PeerjsSession } from '../peerjs';

export type RemoteEvent<PAYLOAD extends Record<string, any>,TAG extends string> = GenericEvent & PAYLOAD & { type: TAG, uuid: string };

export type RemoteActivePlayer = RemoteEvent<GameActivePlayer, 'ACTIVE_PLAYER'>;
export type RemoteCardRevealed = RemoteEvent<GameCardRevealed, 'CARD_REVEALED'>;
export type RemoteCardsHidden = RemoteEvent<{}, 'CARDS_HIDDEN'>;
export type RemotePairSolved = RemoteEvent<GamePairSolved, 'PAIR_SOLVED'>;
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
    | RemotePairSolved
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
        return this.query(this.makeEvent<RemoteActivePlayer>(event, 'ACTIVE_PLAYER'));
    }

    cardRevealed(revealed: GameCardRevealed): Observable<PlayerAck> {
        return this.query(this.makeEvent<RemoteCardRevealed>(revealed, 'CARD_REVEALED'));
    }

    cardsHidden(): Observable<PlayerAck> {
        return this.query(this.makeEvent<RemoteCardsHidden>({}, 'CARDS_HIDDEN'));
    }

    cardsSolved(event: GamePairSolved): Observable<PlayerAck> {
        return this.query(this.makeEvent<RemotePairSolved>(event, 'PAIR_SOLVED'));
    }

    endRound(event: GameRoundEnd): Observable<PlayerNewRound> {
        return this.query(this.makeEvent<RemoteRoundEnd>(event, 'ROUND_END'));
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
                    response$.complete();
                }
            });
            this.query(this.makeEvent<RemoteGameInit>(event,'GAME_INIT')).subscribe(response$);
        });
        return response$;
    }

    playerLeft(event: GamePlayerLeft): Observable<PlayerAck> {
        return this.query(this.makeEvent<RemotePlayerLeft>(event,'PLAYER_LEFT'));
    }

    selectCards(): Observable<PlayerCardSelected> {
        return this.query(this.makeEvent<RemoteSelectCards>({}, 'SELECT_CARDS'));
    }

    startRound(event: GameRoundStart): Observable<PlayerAck> {
        return this.query(this.makeEvent<RemoteRoundStart>(event, 'ROUND_START'));
    }

    private query<QUERY extends RemoteMemoryQuery>(query: QUERY, expectOne?: boolean): Observable<RemoteMemoryResponseTo<QUERY>> {
        return this.session$.pipe(
            take(1),
            switchMap( session => {
                const answer$ = session.events$.pipe(
                    catchError(() => EMPTY),
                    filter<RemoteMemoryResponseTo<QUERY>>( event => event.uuid === query.uuid),
                    expectOne ? first() : (obs) => obs
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

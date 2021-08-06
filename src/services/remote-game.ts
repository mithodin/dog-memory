import type { MemoryGameModal, MemoryPlayer, PlayerName } from './player';
import type { MemoryGame } from './game';
import type { Observable } from 'rxjs';
import { AsyncSubject, EMPTY, filter, forkJoin, map, mapTo, switchMap, tap } from 'rxjs';
import { PeerjsSession } from './peerjs';
import type {
    RemoteMemoryEvent,
    RemoteMemoryQuery,
    RemoteMemoryResponse,
    RemoteMemoryResponseTo
} from './player/remote-player';
import { QueryResponseMapping } from './player/remote-player';

export class RemoteGame implements MemoryGame {
    private readonly playerIndex = 1;
    constructor(private readonly modal: MemoryGameModal, private readonly player: MemoryPlayer) {}

    run(): Observable<void> {
        return this.modal.getGameCode().pipe(
            switchMap( gameCode =>
                forkJoin([PeerjsSession.getHostKey(gameCode, this.playerIndex), PeerjsSession.getGuestKey(gameCode, this.playerIndex)])
            ),
            switchMap( ([hostKey, guestKey]) =>
                this.runGame(new PeerjsSession(guestKey, hostKey))
            ),
            mapTo(null)
        )
    }

    private runGame(peer: PeerjsSession<RemoteMemoryEvent>): Observable<void> {
        const done = new AsyncSubject<void>();
        peer.events$
            .subscribe({
                next: event => {
                    let response: Observable<RemoteMemoryResponse>;
                    switch (event.type) {
                        case 'GAME_INIT':
                            response = this.makeEvent(this.player.init(event).pipe(
                                tap(resp => {
                                    if (resp.hasOwnProperty('leave')) {
                                        peer.close();
                                    }
                                }),
                                filter<PlayerName>(event => event.hasOwnProperty('name')),
                                tap( ev => console.log('answer is ',ev))
                            ), 'NAME', event.uuid);
                            break;
                        case 'ROUND_START':
                            response = this.answerTo(event, (ev) => this.player.startRound(ev));
                            break;
                        case 'ACTIVE_PLAYER':
                            response = this.answerTo(event, (ev) => this.player.activePlayer(ev));
                            break;
                        case 'SELECT_CARDS':
                            response = this.answerTo(event, () => this.player.selectCards());
                            break;
                        case 'CARD_REVEALED':
                            response = this.answerTo(event, (ev) => this.player.cardRevealed(ev));
                            break;
                        case 'CARDS_HIDDEN':
                            response = this.answerTo(event, () => this.player.cardsHidden());
                            break;
                        case 'PAIR_SOLVED':
                            response = this.answerTo(event, (ev) => this.player.cardsSolved(ev));
                            break;
                        case 'ROUND_END':
                            response = this.answerTo(event, (ev) => this.player.endRound(ev));
                            break;
                        case 'PLAYER_LEFT':
                            response = this.answerTo(event, (ev) => this.player.playerLeft(ev));
                            break;
                    }
                    if (response) {
                        response.subscribe(answer => peer.send(answer));
                    }
                },
                complete: () => {
                    done.next();
                    done.complete();
                }
            })
        return done.asObservable();
    }

    private answerTo<QUERY extends RemoteMemoryQuery>(event: QUERY, getAnswer: (ev: QUERY) => Observable<Omit<RemoteMemoryResponseTo<QUERY>,'uuid' | 'type'>>): Observable<RemoteMemoryResponseTo<QUERY>> {
        return this.makeEvent(getAnswer(event), QueryResponseMapping[event.type], event.uuid);
    }

    private makeEvent<PLAYER_EVENT extends RemoteMemoryResponse>(event$: Observable<Omit<PLAYER_EVENT,'uuid' | 'type'>>, type: PLAYER_EVENT['type'], uuid: string): Observable<PLAYER_EVENT> {
        return event$.pipe(
            map( event => ({
                    ...event,
                    type,
                    uuid
                } as PLAYER_EVENT
            ))
        );
    }
}

import type { MemoryGameModal, MemoryPlayer } from './player';
import type { MemoryGame } from './game';
import type { Observable } from 'rxjs';
import { EMPTY, forkJoin, mapTo, ReplaySubject, switchMap } from 'rxjs';
import { PeerjsSession } from './peerjs';
import type { RemoteMemoryEvent } from './player/remote-player';

export class RemoteGame implements MemoryGame {
    private readonly playerIndex = 1;
    constructor(private readonly modal: MemoryGameModal, private readonly player: MemoryPlayer) {}

    run(): Observable<void> {
        return this.modal.getGameCode().pipe(
            switchMap( gameCode =>
                forkJoin(PeerjsSession.getHostKey(gameCode, this.playerIndex), PeerjsSession.getGuestKey(gameCode, this.playerIndex))
            ),
            switchMap( ([hostKey, guestKey]) =>
                this.runGame(new PeerjsSession(guestKey, hostKey))
            ),
            mapTo(null)
        )
    }

    private runGame(peer: PeerjsSession<RemoteMemoryEvent>): Observable<void> {
        return EMPTY;
    }
}

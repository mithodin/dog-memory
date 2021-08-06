import { from, map, Observable, ReplaySubject, Subject, take } from 'rxjs';
import Peer, { DataConnection } from 'peerjs';

export interface GenericEvent {
    type: string;
}

export const CONNECTION_CLOSED = 'CONNECTION_CLOSED';

export class PeerjsSession<EVENTS extends GenericEvent> {
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
        this.connection$.subscribe((connection) => {
            connection.on('close', () => this.events.error(CONNECTION_CLOSED));
            connection.on('data', (data) => this.events.next(data));
        });
        const peer = new Peer(myKey);
        peer.on('open', () => {
            if (remoteKey) {
                const connection = peer.connect(remoteKey, { reliable: true });
                connection.on('open', () => {
                    this.connection$.next(connection);
                });
            } else {
                peer.on('connection', (connection) => {
                    connection.on('open', () => {
                        this.connection$.next(connection);
                    });
                });
            }
        });
    }

    public send(event: EVENTS): void {
        this.connection$.pipe(take(1)).subscribe(connection => {
            connection.send(event);
        });
    }

    public close(): void {
        this.connection$.pipe(take(1)).subscribe( connection => {
            connection.close();
        });
    }
}

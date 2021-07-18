import type { Observable } from "rxjs";
import {AsyncSubject} from "rxjs";
import {modalStore} from "./modal";

export interface PlayerNames {
    player1Name: string,
    player2Name: string
}

export function getPlayerNames(player1Message: string, player2Message: string, button: string): Observable<PlayerNames> {
    const nameResult = new AsyncSubject<PlayerNames>();
    getPlayerName(player1Message, button).subscribe( player1Name => {
        getPlayerName(player2Message, button).subscribe( player2Name => {
            nameResult.next({ player1Name, player2Name });
            nameResult.complete();
        });
    });
    return nameResult.asObservable();
}

export function getPlayerName(message: string, button: string): Observable<string> {
    const nameResult = new AsyncSubject<string>();
    modalStore.set({
        title: message,
        button,
        message: '',
        input: true,
        action: (name) => {
            nameResult.next(name);
            nameResult.complete();
        }
    });
    return nameResult.asObservable();
}

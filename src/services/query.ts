import type { Observable } from 'rxjs';
import { AsyncSubject, map, of, switchMap } from 'rxjs';
import { modalQueue } from './modal';
import type { MessageObject } from 'svelte-i18n/types/runtime/types';

export interface QueryConfig<T extends string> {
    id: T;
    title?: string;
    message?: string;
    button?: string;
    inputValidation?: RegExp;
}

export interface PlayerNames {
    player1Name: string;
    player2Name: string;
}

interface PlayerAnswer {
    input: string,
    buttonClicked: number;
}

export function getPlayerName(
    message: string | MessageObject,
    button: string | MessageObject
): Observable<string> {
    return queryPlayer(message, null, button, true).pipe(
        map( answer => answer.input)
    );
}

export function queryPlayer(
    title: string | MessageObject = '',
    message: string | MessageObject = null,
    button: string | MessageObject | Array<string | MessageObject> = '',
    input: boolean = true,
    inputValidation?: RegExp
): Observable<PlayerAnswer> {
    const result = new AsyncSubject<PlayerAnswer>();
    const buttons = (Array.isArray(button) ? button : [button]).map(
        (buttonLabel, index) => ({
            label: buttonLabel,
            action: (answer) => {
                result.next({ input: answer, buttonClicked: index });
                result.complete();
            }
        })
    );
    modalQueue.next({
        title,
        message,
        input,
        inputValidation,
        buttons
    });
    return result.asObservable();
}

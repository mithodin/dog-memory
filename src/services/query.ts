import type { Observable } from "rxjs";
import {AsyncSubject, of, switchMap} from "rxjs";
import {modalStore} from "./modal";

export interface QueryConfig<T extends string> {
    id: T;
    title?: string;
    message?: string;
    button?: string;
}

export interface PlayerNames {
    player1Name: string;
    player2Name: string;
}

export function getPlayerNames(player1Message: string, player2Message: string, button: string): Observable<PlayerNames> {
    return queryChain([
        {
            id: 'player1Name',
            title: player1Message,
            button
        },
        {
            id: 'player2Name',
            title: player2Message,
            button
        }
    ]);
}

export function queryChain<T extends string>(queries: Array<QueryConfig<T>>): Observable<Record<T,string>> {
    return queryChainImpl<T>(queries, {});
}

function queryChainImpl<T extends string>(queries: Array<QueryConfig<T>>, previousResults: Partial<Record<T, string>>): Observable<Record<T, string>> {
    if( queries.length === 0){
        return of(previousResults as Record<T, string>);
    }
    const [query, ...rest] = queries;
    return queryPlayer(query.title, query.message, query.button).pipe(
        switchMap(result => queryChainImpl<T>(rest, {...previousResults, [query.id]: result}))
    );
}

export function getPlayerName(message: string, button: string): Observable<string> {
    return queryPlayer(message, '', button);
}

export function queryPlayer(title: string = '', message: string = '', button: string = ''): Observable<string> {
    const result = new AsyncSubject<string>();
    modalStore.set({
        title,
        button,
        message,
        input: true,
        action: (name) => {
            result.next(name);
            result.complete();
        }
    });
    return result.asObservable();
}

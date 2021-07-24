import { writable } from 'svelte/store';
import type { MessageObject } from 'svelte-i18n/types/runtime/types';
import { ReplaySubject } from 'rxjs';

export interface ModalMessage {
    title: string | MessageObject;
    message?: string | MessageObject;
    buttons: Array<{ label: string | MessageObject; action?: (input?: string) => void }>;
    input?: boolean;
    inputValidation?: RegExp;
}

export const modalQueue = new ReplaySubject<ModalMessage>();
export const modalStore = writable<ModalMessage>(null);

/**
 * Delayed display example:
 *

 const { rxObserver } = require('api/v0.3');
 const { timer, of, Subject } = require('rxjs');
 const { take, shareReplay, map, delayWhen, startWith, find } = require('rxjs/operators');

 const work = of('Hello','World','nice');
 const available = new Subject();
 const available$ = available
 .pipe(
 startWith(null),
 map((_,i) => i),
 shareReplay(1)
 );

 available$.subscribe(rxObserver());

 const obs = rxObserver();

 work
 .pipe(
 delayWhen((_,i) => available$.pipe(find((ev) => ev === i)))
 )
 .subscribe((ev) => {obs.next(ev); setTimeout(() => {  available.next();}, 10); });

 */

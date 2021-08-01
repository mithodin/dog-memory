import type { Observable, OperatorFunction } from 'rxjs';
import { delayWhen, map, share, shareReplay, startWith } from 'rxjs';
import { find } from 'rxjs/operators';

/*
 * delays each source emission until the next emission from available$.
 * It assumes that the first emission can continue without delay
 */
export function waitUntilNextReady<T>(available$: Observable<void>): OperatorFunction<T, T> {
    return (inputObservable: Observable<T>) => {
        const nextItem$ = available$.pipe(
            startWith(null),
            map((_,i) => i),
            shareReplay(),
        );
        nextItem$.subscribe();
        return inputObservable.pipe(
            map((ev, i) => {
                return ev;
            }),
            delayWhen((_,i) => nextItem$.pipe(find((ev) => ev === i)))
        );
    }
}

import type Hyperbeam from "hyperbeam";
import {createArray} from "./utils";
import type {Observable} from "rxjs";
import {Subject} from "rxjs";

export interface GameEvent {
    card: number;
}

export class RemoteSession {
    private readonly events: Subject<GameEvent> = new Subject<GameEvent>();
    public readonly remoteEvents: Observable<GameEvent> = this.events.asObservable();

    constructor(
        private readonly beam: Hyperbeam
    ) {
        beam.on('data', (data: GameEvent) => this.events.next(data));
    }

    /**
     * Generates an emoji code of length 4, using only animals
     * @param length to keep the probability of collisions below 1/2, the number of active games per second needs to be
     *               below ( 1/2 + sqrt(45**length + 1/4) ) / 1800
     *               length = 3 --> 0.17 games/s
     *               length = 4 --> 1.13 games/s
     *               length = 5 --> 7.55 games/s
     */
    static getEmojiCode(length: number = 4): string {
        const emoji = createArray(length, () => RemoteSession.getAnimalEmoji());
        return emoji.join('');
    }

    private static getAnimalEmoji(): string {
        const firstAnimal = 0x1F400;
        const lastAnimal = 0x1F42C;
        const charCode: number = firstAnimal + Math.floor(Math.random() * (lastAnimal - firstAnimal + 1));
        return String.fromCodePoint(charCode);
    }
}

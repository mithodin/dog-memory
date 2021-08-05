import type { MemoryPlayer, PlayerAck, PlayerCardSelected, PlayerLeave, PlayerName, PlayerNewRound } from './index';
import { playerAck, playerNewRound } from './index';
import type {
    CardConfig,
    GameActivePlayer,
    GameCardRevealed,
    GameInit,
    GamePairSolved,
    GamePlayerLeft,
    GameRoundEnd,
    GameRoundStart
} from '../game';
import { CardState, MemoryGame } from '../game';
import type { Observable } from 'rxjs';
import { delay, map, mapTo, of, startWith, Subject, tap } from 'rxjs';

interface CardMemory {
    image: string;
    index: number;
    partner: number | null;
}

export class KIPlayer implements MemoryPlayer {
    private cards: Array<CardConfig & { index: number }> = null;
    private memory: Array<CardMemory>;
    private newInformation: Subject<string> = new Subject<string>();

    activePlayer(event: GameActivePlayer): Observable<PlayerAck> {
        return of(playerAck());
    }

    private findCardByIndex(index: number): CardMemory {
        let card = this.memory.find(card => card.index === index);
        if( !card ){
            card = {
                image: this.cards[index].pictureURL,
                index,
                partner: null
            };
            this.memory.push(card);
        }
        return card;
    }

    cardRevealed(revealed: GameCardRevealed): Observable<PlayerAck> {
        const alreadyRevealed = this.cards.filter(card => card.state === CardState.REVEALED).length;
        this.cards[revealed.card].state = CardState.REVEALED;
        const mem = this.findCardByIndex(revealed.card);
        if( mem.partner === null ){
            const partner = this.memory.find(card => card.image === mem.image && card.index !== mem.index)
            if( partner ){
                mem.partner = partner.index;
                partner.partner = mem.index;
            }
        }
        if( alreadyRevealed === 0 ){
            this.newInformation.next('revealed card');
        }
        return of(playerAck());
    }

    cardsHidden(): Observable<PlayerAck> {
        this.cards.forEach(card => {
            if( card.state === CardState.REVEALED){
                card.state = CardState.HIDDEN;
            }
        });
        this.newInformation.next('hidden card');
        return of(playerAck());
    }

    private forget(cardIndices: Array<number>): void {
        cardIndices.forEach( index => {
            const inMemoryIndex = this.memory.findIndex(card => card.index === index);
            if( inMemoryIndex >= 0 ) {
                this.memory.splice(inMemoryIndex, 1);
            }
        });
    }

    cardsSolved(event: GamePairSolved): Observable<PlayerAck> {
        this.cards[event.cards[0]].state = CardState.SOLVED;
        this.cards[event.cards[1]].state = CardState.SOLVED;
        this.forget(event.cards);
        this.newInformation.next('solved card');
        return of(playerAck());
    }

    endRound(event: GameRoundEnd): Observable<PlayerNewRound> {
        return of(playerNewRound());
    }

    init(event: GameInit): Observable<PlayerName | PlayerLeave> {
        return of({ name: 'K9-Byte'});
    }

    playerLeft(event: GamePlayerLeft): Observable<PlayerAck> {
        return of(playerAck());
    }

    private randomGuess(): number {
        const known = this.memory.map(card => card.index);
        const unknowns = this.cards
            .filter(card => card.state === CardState.HIDDEN && !known.includes(card.index));
        return unknowns[Math.floor(Math.random()*unknowns.length)]?.index ?? -1;
    }

    private newGuess(): number {
        console.log('I know this:', this.memory);
        const revealed = this.cards.find(card => card.state === CardState.REVEALED);
        if( revealed ){
            const partner = this.memory.find(card => card.partner === revealed.index);
            if( partner ){
                console.log('revealed card has partner');
                return partner.index
            }
        } else {
            const pair = this.memory.find(card => card.partner !== null);
            if( pair ){
                console.log('i know a pair');
                return pair.index;
            }
        }
        console.log('making a random guess');
        return this.randomGuess();
    }

    selectCards(): Observable<PlayerCardSelected> {
        return this.newInformation.pipe(
            tap(info => { console.log(`new information from ${info}`)}),
            startWith(null),
            map(() => this.newGuess()),
            delay(500),
            tap( selection => console.log('Ki selects', selection)),
            map( selected => ({ card: selected }))
        );
    }

    startRound(event: GameRoundStart): Observable<PlayerAck> {
        return MemoryGame.cardLocationToCardConfig(event.cards, false).pipe(
            tap( cards => {
                this.cards = cards.map( (card, i) => ({ ...card, index: i }));
                this.memory = [];
            }),
            mapTo(playerAck())
        );
    }
}

<script lang="ts">
    import type { CardConfig, GameCardRevealed, GamePairSolved, GameRoundStart, MemoryGame } from '../services/game';
    import { CardState, GameMode, LocalGame } from '../services/game';
    import Loading from './Loading.svelte';
    import Board from './Board.svelte';
    import Players from './Players.svelte';
    import type { MemoryGameBoard, MemoryGameHeader, MemoryGameModal, PlayerCardSelected } from '../services/player';
    import { Observable, of, Subject, Subscriber, take } from 'rxjs';
    import { t } from 'svelte-i18n';
    import { range } from '../utils/utils';
    import { getPlayerName, queryPlayer } from '../services/query';
    import { map } from 'rxjs/operators';
    import { navigate } from 'svelte-routing';
    import { onMount } from 'svelte';
    import { KIPlayer } from '../services/player/ki-player';
    import { RemotePlayer } from '../services/player/remote-player';
    import { RemoteGame } from '../services/remote-game';
    import { LocalPlayer } from '../services/player/local-player';

    export let gameMode: GameMode = GameMode.LOCAL;
    export let numPictures: number = 2;

    let playerNames = [$t('game.playerPlaceholder', { values: { playerIndex: 1 }}),$t('game.playerPlaceholder', { values: { playerIndex: 2 }})];
    let activePlayer = 0;
    let gameCode: string = null;
    let cards: Array<CardConfig> = null;
    let columns = 2;
    let clickSubscriber: Subscriber<PlayerCardSelected> = null;
    let active = false;

    function userInput(card: number): void {
        if( clickSubscriber ){
            clickSubscriber.next({ card })
        }
    }

    const boardLoaded: Subject<void> = new Subject<void>();
    const boardController: MemoryGameBoard = {
        getCardSelection(): Observable<PlayerCardSelected> {
            return new Observable<PlayerCardSelected>((subscriber => {
                active = true;
                clickSubscriber = subscriber;
                return () => { clickSubscriber = null; active = false; };
            }));
        },
        hideCards(): void {
            cards = cards.map( card => (card.state === CardState.SOLVED ? card : { ...card, state: CardState.HIDDEN }));
        },
        pairSolved(event: GamePairSolved): void {
            cards = cards.map( (card, index) => (event.cards.includes(index) ? { ...card, state: CardState.SOLVED, solvedBy: event.solvedBy } as CardConfig : card));
        },
        revealCard(event: GameCardRevealed): void {
            cards[event.card] = {
                ...cards[event.card],
                state: CardState.REVEALED
            };
        },
        setup(event: GameRoundStart): Observable<void> {
            cards = null;
            const numCards = event.cards.length * 2;
            columns = Math.ceil(Math.sqrt(numCards));
            LocalGame.cardLocationToCardConfig(event.cards, true).subscribe(loadedCards => {
                cards = loadedCards;
                boardLoaded.next();
            });
            return boardLoaded.pipe(take(1));
        }
    };

    const headerController: MemoryGameHeader = {
        setActivePlayer(index: number): void {
            activePlayer = index;
        },
        setGameCode(_: string): void {},
        setNumberOfPlayers(players: number): void {
            playerNames = range(players).map((index) => $t('game.playerPlaceholder', { values: { playerIndex: index+1 }}));
        },
        setPlayerName(name: string, index: number): void {
            playerNames[index] = name;
        }
    };
    const modalController: MemoryGameModal = {
        getName: (playerIndex: number) =>
            getPlayerName(
                { id: 'query.playerName', values: { playerIndex: (playerIndex + 1).toFixed(0) }},
                'action.okay'
            ),
        getNewRound: (event) =>
            queryPlayer(
                'game.over.title',
                {
                    id: event.winner ? 'game.over.winner' : 'game.over.draw',
                    values: {
                        playerName: event.winner?.name
                    }
                },
                [ 'action.newGame', 'action.close'],
                false
            ).pipe(
                map(answer => answer.buttonClicked === 0)
            ),
        getGameCode: () =>
            queryPlayer(
                'query.gameCode',
                null,
                [ 'action.okay' ]
            ).pipe(
                map(answer => answer.input)
            )
    };

    // player 2 does not need to implement all functions
    const boardController2: MemoryGameBoard = {
        ...boardController,
        hideCards: () => {},
        pairSolved: () => {},
        revealCard: () => {},
        setup: () => boardLoaded.pipe(take(1))
    }
    const headerController2: MemoryGameHeader = {
        setActivePlayer: () => {},
        setGameCode: () => {},
        setNumberOfPlayers: () => {},
        setPlayerName: () => {}
    };
    const modalController2: MemoryGameModal = {
        ...modalController,
        getNewRound: () => of(true)
    };

    function setUpLocal(): LocalGame {
        const player1 = new LocalPlayer(boardController, headerController, modalController);
        const player2 = new LocalPlayer(boardController2, headerController2, modalController2);

        return new LocalGame([player1, player2], numPictures);
    }

    function setUpKI(): LocalGame {
        const player1 = new LocalPlayer(boardController, headerController, modalController);
        const player2 = new KIPlayer();

        return new LocalGame([player1, player2], numPictures);
    }

    function setUpHost(): LocalGame {
        const player1 = new LocalPlayer(boardController, { ...headerController, setGameCode(code: string) { gameCode = code; }}, modalController);
        const player2 = new RemotePlayer();

        return new LocalGame([player1, player2], numPictures);
    }

    function setUpJoin(): RemoteGame {
        const player = new LocalPlayer(boardController, headerController, modalController);
        return new RemoteGame(modalController, player);
    }

    onMount(() => {
        let game: MemoryGame = null;
        switch(gameMode){
            case GameMode.LOCAL:
                game = setUpLocal();
                break;
            case GameMode.KI:
                game = setUpKI();
                break;
            case GameMode.HOST:
                game = setUpHost();
                break;
            case GameMode.JOIN:
                game = setUpJoin();
                break;
        }
        if( game ){
            game.run().subscribe({ complete: () => {navigate('/');}});
        }
    });
</script>

<div class="game">
    <Players
        {activePlayer}
        {playerNames}
        {gameCode}
    />
    {#if !cards}
        <Loading />
    {:else}
        <Board
            {cards}
            {active}
            {columns}
            on:cardSelected={(event) => userInput(event.detail)}
        />
    {/if}
</div>

<style>
    .game {
        display: flex;
        flex-direction: column;
        align-items: center;
    }
</style>

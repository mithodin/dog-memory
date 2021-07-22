<script lang="ts">
    import { onDestroy, onMount } from 'svelte';
    import { t } from 'svelte-i18n';
    import type { GameStore, MemoryGameStateHandler } from '../services/game';
    import { GameMode, getGameStore, handleGameEvent } from '../services/game';
    import { navigate } from 'svelte-routing';
    import { modalStore } from '../services/modal';
    import Loading from './Loading.svelte';
    import { getPlayerName, getPlayerNames, queryChain } from '../services/query';
    import Board from './Board.svelte';
    import Players from './Players.svelte';
    import type { BoardSetupEvent, HostHelloEvent, RemoteSession } from '../services/remote-session';
    import {
        boardSetup,
        cardClicked,
        guestHello,
        hostHello, newGame,
        ready,
        RemoteSessionClient,
        RemoteSessionHost
    } from '../services/remote-session';
    import { firstValueFrom, forkJoin, of, switchMap, tap } from 'rxjs';

    export let gameMode: GameMode = GameMode.LOCAL;
    export let numPictures: number = 2;

    let playersReady = false;
    let localPlayers = [0,1];
    let gameCode: string = null;
    let remoteSession: RemoteSession = null;
    let state: GameStore;
    let unsubscribeState;
    let unsubscribeRemote;
    let waitingToResolve = false;
    let columns = 2;
    let player1Name = $t('game.player1');
    let player2Name = $t('game.player2');

    onMount(async () => {
        columns = Math.ceil(Math.sqrt(2 * numPictures));

        switch (gameMode) {
            case GameMode.LOCAL:
                await setUpLocalSession();
                break;
            case GameMode.JOIN:
                await setUpJoinSession();
                break;
            case GameMode.HOST:
                await setUpHostSession();
                break;
        }

        unsubscribeState = state.subscribe((gameState) => {
            if ( typeof gameState.state.winner === 'number' ) {
                let gameResult = $t('game.over.draw');
                if ( gameState.state.winner === 0 ) {
                    gameResult = $t('game.over.player1win', {
                        values: { player1Name },
                    });
                } else if ( gameState.state.winner === 1 ) {
                    gameResult = $t('game.over.player2win', {
                        values: { player2Name },
                    });
                }
                modalStore.set({
                    title: 'game.over.title',
                    message: gameResult,
                    buttons: [
                        {
                            label: 'action.newGame',
                            action: () => startNewGame(),
                        },
                        {
                            label: 'action.close',
                            action: () => navigate('/'),
                        }
                    ]
                });
            }
        });
    });

    onDestroy(() => {
        if (unsubscribeState) {
            unsubscribeState();
        }
        if (unsubscribeRemote) {
            unsubscribeRemote.unsubscribe();
            remoteSession.close();
        }
    });

    function userInput(index: number) {
        if (remoteSession) {
            remoteSession.send(cardClicked(index));
        }
        cardSelected(index);
    }

    const cardSelected = (index: number) => dispatchGameEvent(index, $state, state);

    async function setUpLocalSession() {
        getPlayerNames(
            'query.player1Name',
            'query.player2Name',
            'action.okay'
        ).subscribe((names) => {
            player1Name = names.player1Name;
            player2Name = names.player2Name;
        });

        const setup = await getGameStore(numPictures);
        state = setup.store;

        playersReady = true;
    }

    async function setUpHostSession() {
        localPlayers = [0];
        gameCode = RemoteSessionHost.getEmojiCode();
        remoteSession = new RemoteSessionHost(gameCode);
        const playerName$ = getPlayerName('query.yourName', 'action.okay').pipe(
            tap((name) => {
                player1Name = name;
            })
        );

        const setup = await getGameStore(numPictures, Math.random() > 0.5 ? 0 : 1);
        const remoteSetup = boardSetup(setup.board);
        state = setup.store;

        const [event, playerName] = await firstValueFrom(
            forkJoin([
                remoteSession.getNext('GUEST_HELLO'),
                playerName$
            ]));
        player2Name = event.name;
        remoteSession.send(hostHello(playerName));
        remoteSession.send(remoteSetup);

        setUpRemoteCommon();
    }

    async function setUpJoinSession() {
        localPlayers = [1];
        const { player2NameR, gameCodeR } = await firstValueFrom(
            queryChain([
                {
                    id: 'player2NameR',
                    title: 'query.yourName',
                    button: 'action.okay',
                },
                {
                    id: 'gameCodeR',
                    title: 'query.gameCode',
                    button: 'action.okay',
                    inputValidation: /^[\u{1F400}-\u{1F42C}]{4}$/u,
                },
            ])
        );
        player2Name = player2NameR;
        gameCode = gameCodeR;

        remoteSession = new RemoteSessionClient(gameCode);
        remoteSession.send(guestHello(player2Name));
        remoteSession.getNext<HostHelloEvent>('HOST_HELLO')
            .subscribe((event) => {
                player1Name = event.name;
            });
        const remoteBoard = await firstValueFrom(
            remoteSession.getNext<BoardSetupEvent>('BOARD_SETUP')
        );
        const setup = await getGameStore(numPictures, 0, remoteBoard);
        state = setup.store;

        setUpRemoteCommon();
    }

    function setUpRemoteCommon(): void {
        unsubscribeRemote = remoteSession.remoteEvents.subscribe((event) => {
            switch (event.type) {
                case 'CARD_CLICKED':
                    cardSelected(event.card);
                    break;
                case 'PLAYER_LEFT':
                    modalStore.set({
                        title: 'game.playerLeft',
                        buttons: [
                            {
                                label: 'action.okay',
                                action: () => navigate('/')
                            }
                        ]
                    });
                    break;
            }
        });

        remoteSession.getNext('READY')
            .subscribe(() => {
                playersReady = true;
            });

        modalStore.set({
            message: '',
            title: 'query.ready',
            buttons: [
                {
                    label: 'action.ready',
                    action: () => remoteSession.send(ready()),
                },
            ],
        });
    }

    function startNewGame(): void {
        switch(gameMode) {
            case GameMode.LOCAL:
                newGameLocal();
                break;
            case GameMode.HOST:
                newGameRemoteHost();
                break;
            case GameMode.JOIN:
                newGameRemoteJoin();
                break;
        }
    }

    function newGameLocal(): void {
        dispatchGameEvent(null, $state, state);
    }

    function newGameRemoteHost(): void {
        remoteSession.reset();
        remoteSession.send(newGame());

        remoteSession.getNext('NEW_GAME').subscribe(() => {
            dispatchGameEvent(of(null), $state, state, (newState) => {
                remoteSession.send(boardSetup({
                    cards: newState.state.boardSetup,
                    firstPlayer: newState.state.firstPlayer
                }))
            });
        });
    }

    function newGameRemoteJoin(): void {
        const obs = remoteSession.getNext('NEW_GAME').pipe(
            switchMap(() => {
                remoteSession.reset();
                remoteSession.send(newGame());
                return remoteSession.getNext('BOARD_SETUP');
            })
        );
        dispatchGameEvent(obs, $state, state);
    }

    function dispatchGameEvent(event: any, state: MemoryGameStateHandler, store: GameStore, callback?: (state: MemoryGameStateHandler) => void): void {
        waitingToResolve = true;
        handleGameEvent(event, state, store).subscribe(newState => {
            if( callback ){
                callback(newState);
            }
            waitingToResolve = false;
        });
    }
</script>

<div class="game">
    {#if $state && !$state.state.loading }
        <Players
            activePlayer={$state.state.player}
            playerNames={[player1Name, player2Name]}
            {gameCode}
        />
        <Board
            cards={$state.state.cards}
            on:cardSelected={(event) => userInput(event.detail)}
            active={!waitingToResolve && localPlayers.includes($state.state.player) && playersReady}
            {columns}
        />
    {:else}
        <Loading />
    {/if}
</div>

<style>
    .game {
        display: flex;
        flex-direction: column;
        align-items: center;
    }
</style>

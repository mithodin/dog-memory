<script lang="ts">
    import {onDestroy, onMount} from "svelte";
    import {t} from "svelte-i18n";
    import type {GameStore} from "../services/game";
    import {GameMode, getGameStore, getStoreUpdate} from "../services/game";
    import {navigate} from "svelte-routing";
    import {modalStore} from "../services/modal";
    import Loading from "./Loading.svelte";
    import {getPlayerName, getPlayerNames, queryChain} from "../services/query";
    import Board from "./Board.svelte";
    import Players from "./Players.svelte";
    import {
        boardSetup,
        cardClicked,
        guestHello, hostHello, ready,
        RemoteSessionClient,
        RemoteSessionHost
    } from "../services/remote-session";
    import type { HostHelloEvent, GuestHelloEvent, BoardSetupEvent, RemoteSession } from "../services/remote-session";
    import {filter, firstValueFrom, forkJoin, take, tap} from "rxjs";

    export let gameMode: GameMode = GameMode.LOCAL;
    export let numPictures: number = 2;

    let playersReady = false;
    let isActive = () => true;
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

        switch( gameMode ){
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

        unsubscribeState = state.subscribe(gameState => {
            if (gameState.state?.revealed?.length === 2) {
                waitingToResolve = true;
                setTimeout(() => {
                    state.update(getStoreUpdate(void 0));
                    waitingToResolve = false
                }, 1000)
            }
            if (gameState.state?.numSolved === gameState.state?.numPictures) {
                const player1points = gameState.state.cards.filter(card => card.solvedBy === 0).length
                const player2points = gameState.state.cards.filter(card => card.solvedBy === 1).length
                let gameResult = $t('game.over.draw');
                if (player1points > player2points) {
                    gameResult = $t('game.over.player1win', {values: {player1Name}});
                } else if (player2points > player1points) {
                    gameResult = $t('game.over.player2win', {values: {player2Name}});
                }
                modalStore.set({
                    title: 'game.over.title',
                    message: gameResult,
                    buttons: [
                        {
                            label: 'action.newGame',
                            action: () => newGame()
                        },
                        {
                            label: 'action.close',
                            action: () => navigate('/')
                        }
                    ]
                });
            }
        })
    });

    onDestroy(() => {
        if (unsubscribeState) {
            unsubscribeState();
        }
        if( unsubscribeRemote) {
            unsubscribeRemote.unsubscribe();
            remoteSession.close();
        }
    });

    function userInput(index: number) {
        if( remoteSession ){
            remoteSession.send(cardClicked(index));
        }
        cardSelected(index);
    }

    function cardSelected(index: number) {
        state.update(getStoreUpdate(index))
    }

    async function setUpLocalSession() {
        getPlayerNames('query.player1Name', 'query.player2Name', 'action.okay').subscribe(names => {
            player1Name = names.player1Name;
            player2Name = names.player2Name;
        });

        const setup = await getGameStore(numPictures);
        state = setup.store;

        playersReady = true;
    }

    async function setUpHostSession() {
        isActive = () => $state.state.player === 0;
        gameCode = RemoteSessionHost.getEmojiCode();
        remoteSession = new RemoteSessionHost(gameCode);
        const playerName$ = getPlayerName('query.yourName', 'action.okay').pipe(
            tap( name => {
                player1Name = name;
            })
        );

        const setup = await getGameStore(numPictures);
        const remoteSetup = boardSetup(setup.board);
        state = setup.store;

        const [event,playerName] = await firstValueFrom(forkJoin<[GuestHelloEvent,string]>(remoteSession.remoteEvents.pipe(
            filter<GuestHelloEvent>((event) => event.type === 'GUEST_HELLO'),
            take(1)
            ),
            playerName$
        ));
        player2Name = event.name;
        remoteSession.send(hostHello(playerName));
        remoteSession.send(remoteSetup);

        setUpRemoteCommon();
    }

    async function setUpJoinSession() {
        isActive = () => $state.state.player === 1;
        const { player2NameR, gameCodeR } = await firstValueFrom(queryChain([
            {
                id: 'player2NameR',
                title: 'query.yourName',
                button: 'action.okay'
            },
            {
                id: 'gameCodeR',
                title: 'query.gameCode',
                button: 'action.okay',
                inputValidation: /^[\u{1F400}-\u{1F42C}]{4}$/u
            }
        ]));
        player2Name = player2NameR;
        gameCode = gameCodeR;

        remoteSession = new RemoteSessionClient(gameCode);
        remoteSession.send(guestHello(player2Name));
        remoteSession.remoteEvents.pipe(
            filter<HostHelloEvent>((event) => event.type === 'HOST_HELLO'),
            take(1)
        ).subscribe( event => {
            player1Name = event.name;
        });
        const remoteBoard = await firstValueFrom(remoteSession.remoteEvents.pipe(
            filter<BoardSetupEvent>( event => event.type === "BOARD_SETUP" )
        ));
        const setup = await getGameStore(numPictures, remoteBoard.cards);
        state = setup.store;

        setUpRemoteCommon();
    }

    function setUpRemoteCommon(): void {
        unsubscribeRemote = remoteSession.remoteEvents.subscribe((event) => {
            switch( event.type ){
                case "CARD_CLICKED":
                    cardSelected(event.card);
                    break;
            }
        });

        remoteSession.remoteEvents.pipe(
            filter((event) => event.type === 'READY'),
            take(1)
        ).subscribe( () => { playersReady = true })

        modalStore.set({
            message: '',
            title: 'query.ready',
            buttons: [
                {
                    label: 'action.ready',
                    action: () => remoteSession.send(ready())
                }
            ]
        });
    }

    function newGame(): void {

    }
</script>
<div class="game">
{#if $state}
    <Players activePlayer={$state.state.player} playerNames={[player1Name, player2Name]} {gameCode}/>
    <Board cards={$state.state.cards} on:cardSelected={(event) => userInput(event.detail)} active={!waitingToResolve && isActive() && playersReady} {columns}/>
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

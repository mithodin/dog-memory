<script lang="ts">
    import {onDestroy, onMount} from "svelte";
    import {t} from "svelte-i18n";
    import type {GameStore} from "../services/game";
    import {GameMode, getGameStore, getStoreUpdate} from "../services/game";
    import {navigate} from "svelte-routing";
    import {modalStore} from "../services/modal";
    import Loading from "./Loading.svelte";
    import {getPlayerNames} from "../services/query";
    import Board from "./Board.svelte";
    import Players from "./Players.svelte";

    export let gameMode: GameMode = GameMode.LOCAL;
    export let numPictures: number = 2;

    let state: GameStore;
    let unsubscribeState;
    let waitingToResolve = false;
    let columns = 2;
    let player1Name = $t('game.player1');
    let player2Name = $t('game.player2');

    onMount(async () => {
        getPlayerNames($t('query.player1Name'), $t('query.player2Name'), $t('action.okay')).subscribe(names => {
            player1Name = names.player1Name;
            player2Name = names.player2Name;
        });

        columns = Math.ceil(Math.sqrt(2 * numPictures));
        state = await getGameStore(numPictures);
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
                    title: $t('game.over.title'),
                    message: gameResult,
                    button: $t('action.close'),
                    action: () => navigate('/')
                });
            }
        })
    });

    onDestroy(() => {
        if (unsubscribeState) {
            unsubscribeState();
        }
    });

    function cardSelected(index: number) {
        state.update(getStoreUpdate(index))
    }
</script>
<div class="game">
{#if $state}
    <Players activePlayer={$state.state.player} playerNames={[player1Name, player2Name]} />
    <Board cards={$state.state.cards} on:cardSelected={(event) => cardSelected(event.detail)} active={!waitingToResolve} {columns}/>
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

<script lang="ts">
    import {onDestroy, onMount} from "svelte";
    import Card from "./Card.svelte";
    import {getGameStore, getStoreUpdate} from "../services/game";
    import type {GameStore} from "../services/game";

    export let numPictures: number = 2;

    const backside = '/assets/backside.jpg';
    let state: GameStore;
    let unsubscribeState;
    let waitingToResolve = false;
    let columns = 2;

    onMount(async () => {
        columns = Math.ceil(Math.sqrt(2*numPictures));
        state = await getGameStore(numPictures);
        unsubscribeState = state.subscribe( gameState => {
            if( gameState.state?.revealed?.length === 2) {
                waitingToResolve = true;
                setTimeout(() => {state.update(getStoreUpdate(void 0)); waitingToResolve = false}, 1000)
            }
        })
    });

    onDestroy(() => {
        if( unsubscribeState ){
            unsubscribeState();
        }
    });

    function handleEvent(ev: number){
        if(!waitingToResolve){
            state.update(getStoreUpdate(ev))
        }
    }
</script>
<div class="game">
{#if $state}
    <div class="players">
        <div class="player player-one" class:active={$state.state.player === 0}>Player 1</div>
        <div class="player player-two" class:active={$state.state.player === 1}>Player 2</div>
    </div>
    <div class="cards" style={`max-width: ${columns * 210}px`}>
        {#each $state.state.cards as card, index}
            <Card {backside} cardConfig={card} on:click={() => handleEvent(index)} />
        {/each}
    </div>
{:else}
    Loading...
{/if}
</div>

<style>
    .game {
        display: flex;
        flex-direction: column;
        align-items: center;
    }

    .players {
        display: flex;
        justify-content: center;
        align-items: baseline;
        vertical-align: baseline;
    }

    .player {
        padding: 5px;
        vertical-align: baseline;
    }

    .active {
        font-size: 150%;
        font-weight: bold;
    }

    .player-one {
        color: rgb(255,0,0);
    }

    .player-two {
        color: rgb(0,0,255);
    }

    .cards {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
    }
</style>

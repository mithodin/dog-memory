<script lang="ts">
    import {onDestroy, onMount} from "svelte";
    import Card from "./Card.svelte";
    import {getGameStore, getStoreUpdate, CardState} from "../services/game";
    import type {GameStore} from "../services/game";

    export let numPictures: number = 2;

    const backside = '/assets/backside.jpg';
    let state: GameStore;
    let unsubscribeState;
    let waitingToResolve = false;

    onMount(async () => {
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
{#if $state}
    {#each $state.state.cards as card, index}
        <Card {backside} frontside={card.pictureURL} revealed={card.state !== CardState.HIDDEN} on:click={() => handleEvent(index)} />
    {/each}
    { JSON.stringify($state.state)}
{/if}

<script lang="ts">
    import type {CardConfig} from "../services/game";
    import {createEventDispatcher} from "svelte";
    import Card from "./Card.svelte";

    export let active: boolean = false;
    export let cards: Array<CardConfig> = [];
    export let columns: number;

    const dispatch = createEventDispatcher<{ cardSelected: number }>();
    const backside = '/assets/backside.jpg';

    function emitIfActive(index: number): void {
        if (active) {
            dispatch('cardSelected', index);
        }
    }
</script>
<div class="cards" style={`max-width: ${columns * 210}px`} class:disabled={!active}>
    {#each cards as card, index}
    <Card {backside} cardConfig={card} on:mouseup={() => emitIfActive(index)} />
{/each}
</div>

<style>
    .disabled {
        pointer-events: none;
    }

    .cards {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
    }
</style>

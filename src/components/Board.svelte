<script lang="ts">
    import type { CardConfig } from '../services/game';
    import { createEventDispatcher } from 'svelte';
    import Card from './Card.svelte';
    import { filter, groupBy, mergeMap, Subject, throttleTime } from 'rxjs';

    export let active: boolean = false;
    export let cards: Array<CardConfig> = [];
    export let columns: number;

    const dispatch = createEventDispatcher<{ cardSelected: number }>();
    const backside = '/assets/backside.jpg';
    const debouncer$ = new Subject<number>();
    debouncer$.pipe(
        filter(() => active),
        groupBy(i => i),
        mergeMap( group$ => group$.pipe(throttleTime(1000))),
    ).subscribe( selected => {
        dispatch('cardSelected', selected);
    })
</script>

<div
    class="cards"
    style={`max-width: ${columns * 210}px`}
    class:disabled={!active}
>
    {#each cards as card, index}
        <Card
            {backside}
            cardConfig={card}
            on:mouseup={() => debouncer$.next(index)}
        />
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

<script lang="ts">
    export let activePlayer: number = 0;
    export let playerNames: Array<string>;
</script>

<div class="players">
    {#each playerNames as player, index}
        <div class={`player player-${index}`} class:active={activePlayer === index}>{player}</div>
    {/each}
</div>

<style>
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

    .player-0 {
        color: rgb(255,0,0);
    }

    .player-1 {
        color: rgb(0,0,255);
    }
</style>

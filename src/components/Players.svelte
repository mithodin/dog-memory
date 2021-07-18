<script lang="ts">
    import {t} from "svelte-i18n";
    export let activePlayer: number = 0;
    export let playerNames: Array<string>;
    export let gameCode: string = null;
</script>

<div class="menu">
    {#if gameCode}
        <div class="game-code">
            { $t('game.code') } { gameCode }
        </div>
    {/if}
    <div class="players">
        {#each playerNames as player, index}
            <div class={`player player-${index}`} class:active={activePlayer === index}>{player}</div>
        {/each}
    </div>
</div>

<style>
    .menu {
        width: 100%;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }

    .game-code {
        flex-grow: 0;
        font-size: 150%;
    }

    .players {
        flex-grow: 1;
        display: flex;
        flex-direction: row;
        justify-content: center;
        align-items: baseline;
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

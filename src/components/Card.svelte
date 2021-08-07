<script lang="ts">
    import { t } from 'svelte-i18n';
    import { CardState } from '../services/game';
    import type { CardConfig } from '../services/game';

    export let backside: string;
    export let cardConfig: CardConfig;
</script>

<div
    class="card-container"
    on:mouseup|preventDefault|stopPropagation
    on:auxclick|stopPropagation|preventDefault
    class:clickable={cardConfig.state === CardState.HIDDEN}
>
    <img
        src={backside}
        alt={$t('img.backside.alt')}
        class:show={cardConfig.state === CardState.HIDDEN}
    />
    <img
        src={cardConfig.pictureURL}
        alt={$t('img.frontside.alt')}
        class:show={cardConfig.state !== CardState.HIDDEN}
        class:solved={cardConfig.state === CardState.SOLVED}
    />
    {#if cardConfig.state === CardState.SOLVED}
        <div
            class="overlay"
            class:player-one={cardConfig.solvedBy === 0}
            class:player-two={cardConfig.solvedBy === 1}
        > </div>
    {/if}
</div>

<style>
    .card-container {
        height: 200px;
        width: 200px;
        position: relative;
        margin: 5px;
        /* for mobile */
        max-width: 29vw;
        max-height: 29vw;
    }

    .clickable {
        cursor: pointer;
    }

    .card-container img {
        height: 100%;
        width: 100%;
        object-fit: cover;
        border-radius: 20px;
        display: none;
        pointer-events: none;
    }

    .card-container img.show {
        display: initial;
    }

    .card-container img.solved {
        filter: grayscale(1);
    }

    .card-container .overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: block;
        border-radius: 20px;
    }

    .player-one {
        background-color: rgba(255, 0, 0, 0.3);
    }

    .player-two {
        background-color: rgba(0, 0, 255, 0.3);
    }
</style>

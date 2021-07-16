<script lang="ts">
    import {CardState} from "../services/game";
    import type {CardConfig} from "../services/game";

    export let backside: string;
    export let cardConfig: CardConfig;
</script>

<div class="card-container" on:click>
    {#if cardConfig.state === CardState.REVEALED }
        <img src={cardConfig.pictureURL} alt="a dog"/>
    {:else if cardConfig.state === CardState.SOLVED }
        <img src={cardConfig.pictureURL} alt="a dog" class="solved"/>
        <div class="overlay" class:player-one={cardConfig.solvedBy === 0} class:player-two={cardConfig.solvedBy === 1}></div>
    {:else}
        <img src={backside} alt="what could it be?" />
    {/if}
</div>

<style>
    .card-container {
        height: 200px;
        width: 200px;
        cursor: pointer;
        position: relative;
    }

    .card-container img {
        height: 100%;
        width: 100%;
        object-fit: cover;
        border-radius: 20px;
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
        background-color: rgba(255,0,0,0.3);
    }

    .player-two {
        background-color: rgba(0,0,255,0.3);
    }
</style>

<script lang="ts">
    export let backside: string;
    export let frontside: string;
    export let revealed: boolean = false;
</script>

<div class="card-container" on:click>
    {#if (revealed)}
        <img src={frontside}/>
    {:else}
        <img src={backside}/>
    {/if}
</div>

<style>
    .card-container {
        height: 200px;
        width: 200px;
    }

    .card-container img {
        height: 100%;
        width: 100%;
        object-fit: cover;
        border-radius: 20px;
    }
</style>

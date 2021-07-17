<script lang="ts">
    import {modalStore} from "../services/modal";
    import type { ModalMessage } from "../services/modal";

    function closeModal(message: ModalMessage): void {
        if( message.action ){
            message.action();
        }
        modalStore.set(null);
    }
</script>

{#if $modalStore}
    <div class="modal-container">
        <div class="window">
            <h2>{ $modalStore.title }</h2>
            <p>{ $modalStore.message }</p>
            <button on:click={() => closeModal($modalStore)}>{ $modalStore.button }</button>
        </div>
    </div>
{/if}

<style>
    .modal-container {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0,0,0,0.2);
        display: flex;
        justify-content: center;
        align-items: center;
    }

    .window {
        padding: 10px;
        border-radius: 10px;
        background-color: #fff;
        border: 2px solid #000;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }
</style>

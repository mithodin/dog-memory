<script lang="ts">
    import {t} from "svelte-i18n";
    import {modalStore} from "../services/modal";
    import type { ModalMessage } from "../services/modal";

    let userInput;

    function keyPress(event: KeyboardEvent, message: ModalMessage): void {
        if( event.key === 'Enter' ){
            closeModal(message);
        }
    }

    function closeModal(message: ModalMessage): void {
        if( message.input ){
            if( !userInput ){
                return;
            }
            if( message.inputValidation && !userInput.match(message.inputValidation)){
                return;
            }
        }
        modalStore.set(null);
        const input = userInput;
        userInput = undefined;
        if( message.action ){
            message.action(input);
        }
    }
</script>

{#if $modalStore}
    <div class="modal-container">
        <div class="window">
            <h2>{ $t($modalStore.title) }</h2>
            {#if $modalStore.message }
            <p>{ $t($modalStore.message) }</p>
            {/if}
            {#if $modalStore.input}
                <input type="text" bind:value={userInput} maxlength="20" on:keyup={(event) => keyPress(event, $modalStore)} autofocus/>
            {/if}
            <button on:click={() => closeModal($modalStore)}>{ $t($modalStore.button) }</button>
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

    button {
        margin-top: 10px;
    }
</style>

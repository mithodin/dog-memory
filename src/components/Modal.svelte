<script lang="ts">
    import { t } from 'svelte-i18n';
    import { modalQueue, modalStore } from '../services/modal';
    import type { ModalMessage } from '../services/modal';
    import { Subject } from 'rxjs';
    import { waitUntilNextReady } from '../utils/wait-until-next-ready';

    let userInput;
    const available: Subject<void> = new Subject<void>();
    modalQueue.pipe(
        waitUntilNextReady(available)
    ).subscribe((message) => {
        modalStore.set(message);
    });

    function keyPress(event: KeyboardEvent, message: ModalMessage): void {
        if (event.key === 'Enter') {
            const action = message.buttons.find(() => true)?.action;
            closeModal(message, action);
        }
    }

    function closeModal(
        message: ModalMessage,
        action?: (input?: string) => void
    ): void {
        if (message.input) {
            if (!userInput) {
                return;
            }
            if (
                message.inputValidation &&
                !userInput.match(message.inputValidation)
            ) {
                return;
            }
        }
        modalStore.set(null);
        const input = userInput;
        userInput = undefined;
        if (action) {
            action(input);
        }
        available.next();
    }
</script>

{#if $modalStore}
    <div class="modal-container">
        <div class="window">
            <h2>{$t($modalStore.title)}</h2>
            {#if $modalStore.message}
                <p>{$t($modalStore.message)}</p>
            {/if}
            {#if $modalStore.input}
                <input
                    type="text"
                    bind:value={userInput}
                    maxlength="20"
                    on:keyup={(event) => keyPress(event, $modalStore)}
                    autofocus
                />
            {/if}
            {#each $modalStore.buttons as button}
                <button on:click={() => closeModal($modalStore, button.action)}
                    >{$t(button.label)}</button
                >
            {/each}
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
        background-color: rgba(0, 0, 0, 0.2);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 30;
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

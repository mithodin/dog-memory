import { writable } from 'svelte/store';
import type { MessageObject } from 'svelte-i18n/types/runtime/types';

export interface ModalMessage {
    title: string | MessageObject;
    message?: string | MessageObject;
    buttons: Array<{ label: string | MessageObject; action?: (input?: string) => void }>;
    input?: boolean;
    inputValidation?: RegExp;
}

export const modalStore = writable<ModalMessage>(null);

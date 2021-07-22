import {writable} from "svelte/store";

export interface ModalMessage {
    title: string;
    message?: string;
    buttons: Array<{ label: string, action?: (input?: string) => void}>;
    input?: boolean;
    inputValidation?: RegExp;
}

export const modalStore = writable<ModalMessage>(null);

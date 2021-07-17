import {writable} from "svelte/store";

export interface ModalMessage {
    title: string;
    message: string;
    button: string;
    action?: () => void;
}

export const modalStore = writable<ModalMessage>(null);

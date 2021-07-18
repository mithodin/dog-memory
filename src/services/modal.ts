import {writable} from "svelte/store";

export interface ModalMessage {
    title: string;
    message: string;
    button: string;
    action?: (input?: string) => void;
    input?: boolean;
}

export const modalStore = writable<ModalMessage>(null);

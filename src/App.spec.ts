import { render, RenderResult } from '@testing-library/svelte';
import App from './App.svelte';

describe('main component', () => {
    let component: RenderResult;

    beforeEach(() => {
        component = render(App, { props: {} });
    });
});

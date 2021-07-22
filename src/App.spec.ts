import { render, RenderResult } from '@testing-library/svelte';
import App from './App.svelte';

describe('main component', () => {
    let component: RenderResult;

    beforeEach(() => {
        component = render(App, { props: { name: 'world' } });
    });

    it('should render', () => {
        expect(() => component.getByText('Hello world!')).not.toThrow();
    });

    it('should contain the string "Blubb"', () => {
        expect(() => component.getByText('Blubb')).not.toThrow();
    });
});

import { getLocaleFromNavigator, init, register } from 'svelte-i18n';

export function setupI18n(): void {
    register('en', () => import('./en.json'));
    register('de', () => import('./de.json'));

    init({
        fallbackLocale: 'en',
        initialLocale: getLocaleFromNavigator(),
    });
}

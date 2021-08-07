const sveltePreprocess = require('svelte-preprocess');

module.exports = {
    preprocess: sveltePreprocess(),
    publicPath: process.env.NODE_ENV === 'production'
        ? '/dog-memory/'
        : '/'
};

<script>
    import { Router, Link, Route } from 'svelte-routing';
    import { t } from 'svelte-i18n';
    import { isLoading } from 'svelte-i18n';
    import Game from './components/Game.svelte';
    import Modal from './components/Modal.svelte';
    import { GameMode } from './services/game';
    import { publicPath } from '../svelte.config';

    export let url = '';

    const playIcon = '/assets/dog.svg';
    const hostIcon = '/assets/dog-host.svg';
    const joinIcon = '/assets/dog-join.svg';
    const kiIcon = '/assets/dog-ki.svg';
</script>

{#if !$isLoading}
    <Router {url} basepath={publicPath}>
        <Route path="play">
            <Game numPictures={6} gameMode={GameMode.LOCAL} />
        </Route>
        <Route path="ki">
            <Game numPictures={6} gameMode={GameMode.KI} />
        </Route>
        <Route path="join">
            <Game numPictures={6} gameMode={GameMode.JOIN} />
        </Route>
        <Route path="host">
            <Game numPictures={6} gameMode={GameMode.HOST} />
        </Route>
        <Route path="/">
            <nav>
                <Link to="play">
                    <div class="play">
                        <img src={playIcon} alt={$t('action.play')} />
                        <span class="text">{$t('action.play')}</span>
                    </div>
                </Link>
                <Link to="ki">
                    <div class="play">
                        <img src={kiIcon} alt={$t('action.playKi')} />
                        <span class="text">{$t('action.playKi')}</span>
                    </div>
                </Link>
                <Link to="join">
                    <div class="play">
                        <img src={joinIcon} alt={$t('action.join')} />
                        <span class="text">{$t('action.join')}</span>
                    </div>
                </Link>
                <Link to="host">
                    <div class="play">
                        <img src={hostIcon} alt={$t('action.host')} />
                        <span class="text">{$t('action.host')}</span>
                    </div>
                </Link>
            </nav>
        </Route>
    </Router>
    <Modal />
{/if}

<style>
    nav {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
        flex-wrap: wrap;
    }

    .play {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        padding: 15px;
        cursor: pointer;
    }

    .play:hover {
        background-color: #d31145;
        border-radius: 20px;
    }

    .play img {
        max-height: 30vh;
    }

    .play .text {
        font-size: 50px;
        font-weight: bold;
        color: #d31145;
        text-align: center;
    }

    .play:hover .text {
        color: #fff;
    }
</style>

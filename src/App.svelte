<script>
    import {Router, Link, Route} from "svelte-routing";
    import Game from "./components/Game.svelte";
    import Modal from "./components/Modal.svelte";

    export let url = "";

    const playIcon = '/assets/dog.svg';
</script>
<Router url={url}>
    <Route path="play">
        <Game numPictures={6}/>
    </Route>
    <Route path="/">
        <nav>
            <Link to="play">
                <div class="play">
                    <img src={playIcon} alt="play"/>
                    <span class="text">play</span>
                </div>
            </Link>
        </nav>
    </Route>
</Router>
<Modal />

<style>
    nav {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 100%;
    }

    .play {
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
    }

    .play .text {
        font-size: 50px;
        font-weight: bold;
        color: #d31145;
    }
</style>

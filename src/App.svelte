<script>
    import { Router, Link, Route } from "svelte-routing";
    import Game from "./components/Game.svelte";

    export let url = "";
</script>


<Router url={url}>
    <div>
        <Route path="play">
            <Game numPictures={6}/>
        </Route>
        <Route path="/">
            <nav>
                <Link to="play">Play</Link>
            </nav>
        </Route>
    </div>
</Router>

<svg id="svg-sprite">
    <symbol id="paw" viewBox="0 0 249 209.32">
        <ellipse cx="27.917" cy="106.333" stroke-width="0" rx="27.917" ry="35.833"/>
        <ellipse cx="84.75" cy="47.749" stroke-width="0" rx="34.75" ry="47.751"/>
        <ellipse cx="162" cy="47.749" stroke-width="0" rx="34.75" ry="47.751"/>
        <ellipse cx="221.083" cy="106.333" stroke-width="0" rx="27.917" ry="35.833"/>
        <path stroke-width="0" d="M43.98 165.39s9.76-63.072 76.838-64.574c0 0 71.082-6.758 83.096 70.33 0 0 2.586 19.855-12.54 31.855 0 0-15.75 17.75-43.75-6.25 0 0-7.124-8.374-24.624-7.874 0 0-12.75-.125-21.5 6.625 0 0-16.375 18.376-37.75 12.75 0 0-28.29-7.72-19.77-42.86z"/>
    </symbol>
</svg>
<div class="loading">
    <div class="paw-loader">
        <div class="paw"><svg class="icon"><use xlink:href="#paw" /></svg></div>
        <div class="paw"><svg class="icon"><use xlink:href="#paw" /></svg></div>
        <div class="paw"><svg class="icon"><use xlink:href="#paw" /></svg></div>
        <div class="paw"><svg class="icon"><use xlink:href="#paw" /></svg></div>
        <div class="paw"><svg class="icon"><use xlink:href="#paw" /></svg></div>
        <div class="paw"><svg class="icon"><use xlink:href="#paw" /></svg></div>
    </div>
    <div class="loading-text">

        Loading...
    </div>
</div>

<style>
    .loading {
        position: fixed;
        top: 0;
        bottom: 0;
        left: 0;
        right: 0;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: #d31145;
        font-size: 50px;
    }
    .paw-loader {
        transform-origin: 50% 50%;
        transform: rotate(90deg) translate(-50%, 0%);
        width: 1em;
        height: 3em;
    }
    .paw-loader .paw {
        width: 1em;
        height: 1em;
        -webkit-animation: 2050ms pawAnimation ease-in-out infinite;
        animation: 2050ms pawAnimation ease-in-out infinite;
        opacity: 0;
    }
    .paw-loader .paw svg {
        width: 100%;
        height: 100%;
    }
    .paw-loader .paw .icon {
        fill: currentColor;
    }
    .paw-loader .paw:nth-child(odd) {
        transform: rotate(-10deg);
    }
    .paw-loader .paw:nth-child(even) {
        transform: rotate(10deg) translate(125%, 0);
    }
    .paw-loader .paw:nth-child(1) {
        -webkit-animation-delay: 1.25s;
        animation-delay: 1.25s;
    }
    .paw-loader .paw:nth-child(2) {
        -webkit-animation-delay: 1s;
        animation-delay: 1s;
    }
    .paw-loader .paw:nth-child(3) {
        -webkit-animation-delay: 0.75s;
        animation-delay: 0.75s;
    }
    .paw-loader .paw:nth-child(4) {
        -webkit-animation-delay: 0.5s;
        animation-delay: 0.5s;
    }
    .paw-loader .paw:nth-child(5) {
        -webkit-animation-delay: 0.25s;
        animation-delay: 0.25s;
    }
    .paw-loader .paw:nth-child(6) {
        -webkit-animation-delay: 0s;
        animation-delay: 0s;
    }
    .no-cssanimations .paw-loader .paw {
        opacity: 1;
    }

    @-webkit-keyframes pawAnimation {
        0% {
            opacity: 1;
        }
        50% {
            opacity: 0;
        }
        100% {
            opacity: 0;
        }
    }

    @keyframes pawAnimation {
        0% {
            opacity: 1;
        }
        50% {
            opacity: 0;
        }
        100% {
            opacity: 0;
        }
    }
</style>

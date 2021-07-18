declare module 'hyperbeam' {
    import {Duplex} from "streamx";

    class Hyperbeam extends Duplex {
        constructor(key: string);

        get connected(): boolean;
    }

    export = Hyperbeam;
}

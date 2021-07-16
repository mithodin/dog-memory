import axios, {AxiosInstance} from "axios";

export class DogApi {
    private readonly api: AxiosInstance;

    constructor(
        private readonly baseURL: string
    ) {
        this.api = axios.create({ baseURL: this.baseURL });
    }

    public getDog(): Promise<string> {
        return this.api.get('/woof?include=jpg').then( response => `${this.baseURL}${response.data}`);
    }

    public getDogs(howMany: number): Promise<Array<string>> {
        return Promise.all(new Array(howMany).fill(0).map(() => this.getDog()));
    }
}

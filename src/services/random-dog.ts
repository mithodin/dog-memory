import axios, {AxiosInstance} from "axios";

export class DogApi {
    private readonly api: AxiosInstance;

    constructor(
        private readonly baseURL: string
    ) {
        this.api = axios.create({ baseURL: this.baseURL });
    }

    public getDogURL(): Promise<string> {
        return this.api.get('/woof?include=jpg').then( response => `${this.baseURL}${response.data}`);
    }

    public getDogs(howMany: number): Promise<Array<string>> {
        return Promise.all(new Array(howMany).fill(0).map(() => this.getDogURL().then( url => this.downloadDog(url))));
    }

    private downloadDog(url: string): Promise<string> {
        return this.api.get(url, { responseType: 'blob'}).then( imgBlob => URL.createObjectURL(imgBlob.data))
    }
}

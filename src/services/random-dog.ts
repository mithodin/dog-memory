import axios, { AxiosInstance } from 'axios';
import { createArray } from '../utils/utils';

export class DogApi {
    private readonly api: AxiosInstance;

    constructor(private readonly baseURL: string) {
        this.api = axios.create({ baseURL: this.baseURL });
    }

    public getDogURL(): Promise<string> {
        return this.api
            .get('/woof?filter=webm,mp4')
            .then((response) => `${this.baseURL}${response.data}`);
    }

    public getDogs(howMany: number): Promise<Array<string>> {
        return Promise.all(createArray(howMany, () => this.getDogURL()));
    }

    public downloadDog(url: string): Promise<string> {
        return this.api
            .get(url, { responseType: 'blob' })
            .then((imgBlob) => URL.createObjectURL(imgBlob.data));
    }
}

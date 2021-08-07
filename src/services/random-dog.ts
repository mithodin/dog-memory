import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { createArray } from '../utils/utils';
import { from, map, Observable } from 'rxjs';
import { shuffleArray } from './shuffle';

export class DogApi {
    private readonly filter = 'webm,mp4';
    private readonly api: AxiosInstance;

    constructor(private readonly baseURL: string) {
        this.api = axios.create({ baseURL: this.baseURL });
    }

    public getDogURL(): Promise<string> {
        return this.api
            .get(`/woof?filter=${this.filter}`)
            .then((response) => `${this.baseURL}${response.data}`);
    }

    public getDogs(howMany: number): Observable<Array<string>> {
        return from(this.api.get<any,AxiosResponse<Array<string>>>(`/doggos?filter=${this.filter}`)).pipe(
            map( response => response.data ),
            map( doggos => shuffleArray(doggos).slice(0,howMany)),
            map( doggos => doggos.map( url => `${this.baseURL}${url}`))
        );
    }

    public downloadDog(url: string): Promise<string> {
        return this.api
            .get(url, { responseType: 'blob' })
            .then((imgBlob) => URL.createObjectURL(imgBlob.data));
    }
}

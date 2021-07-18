export function createArray<T>(length: number, filler: () => T): Array<T> {
    return new Array(length).fill(0).map(() => filler());
}

export function range(length: number): Array<number> {
    return new Array(length).fill(0).map((_,i) => i);
}

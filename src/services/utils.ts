export function createArray<T>(length: number, filler: () => T): Array<T> {
    return new Array(length).fill(0).map(() => filler());
}

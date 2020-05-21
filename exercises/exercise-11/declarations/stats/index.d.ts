type Comparator<T> = (a: T, b: T) => number;
type GetIndexFunction = <T>(elements: T[], comparator: Comparator<T>) => number;
type GetElementFunction = <T>(elements: T[], comparator: Comparator<T>) => T;

declare module 'stats' {
    export const getMaxIndex: GetIndexFunction;
    export const getMinIndex: GetIndexFunction;
    export const getMaxElement: GetElementFunction;
    export const getMinElement: GetElementFunction;
    export const getMedianIndex: GetIndexFunction;
    export const getMedianElement: GetElementFunction;
    export const getAverageValue: GetIndexFunction;
}

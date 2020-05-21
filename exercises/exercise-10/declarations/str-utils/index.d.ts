type StringManipulator = (str: string) => string;
declare module 'str-utils' {
    export const strReverse: StringManipulator;
    export const strToLower: StringManipulator;
    export const strToUpper: StringManipulator;
    export const strRandomize: StringManipulator;
    export const strInvertCase: StringManipulator;
}

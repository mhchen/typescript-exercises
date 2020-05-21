// This enabled module augmentation mode.
import 'date-wizard';

declare module 'date-wizard' {
    export const pad: (numberToPad: number) => string;
    interface DateDetails {
        hours: number;
    }
}

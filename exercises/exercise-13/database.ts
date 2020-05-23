import * as fs from 'fs';

type Criteria<V> = {
    $gt: number,
} | {
    $lt: number,
} | {
    $eq: number | string,
}

type Query<T> = Omit<{
    [K in Exclude<keyof T, '$text'>]?: Criteria<T[K]>;
}, '$text'> | {
    $text: string;
} | {
    $or: [Query<T>, Query<T>]
} | {
    $and: [Query<T>, Query<T>]
}

export class Database<T extends { [key: string]: string }> {
    protected records: T[];
    protected fullTextSearchFieldNames: (keyof T)[];

    constructor(filename: string, fullTextSearchFieldNames: (keyof T)[]) {
        this.fullTextSearchFieldNames = fullTextSearchFieldNames;
        const lines = fs.readFileSync(filename, 'utf-8').trim().split('\n');
        this.records = [];
        for (const line of lines) {
            if (!line.startsWith('E')) {
                continue;
            }
            this.records.push(JSON.parse(line.replace(/^E/, '')) as T);
        }
    }

    async find(query: Query<T>): Promise<T[]> {
        if ('$text' in query) {
            return this.records.filter((record) => {
                for (const field of this.fullTextSearchFieldNames) {
                    if (record[field].includes(query.$text)) {
                    }
                }
            })
        }
    }
}

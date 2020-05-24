import {promises as fs} from 'mz/fs';

type Criteria<V> = {
    $gt: V;
} | {
    $lt: V;
} | {
    $eq: V;
} | {
    $in: V[];
}

type PropertyQuery<T extends {}> = {
    [K in keyof T]?: Criteria<T[K]>;
}

type Query<T> = PropertyQuery<T> & {
    $text?: string;
    $or?: Query<T>[];
    $and?: Query<T>[];
};

type ProjectionOption<T> = {
    projection?: {
        [K in keyof T]?: 1;
    };
}

type Options<T> = {
    projection?: {
        [K in keyof T]?: 1;
    }
    sort?: {
        [K in keyof T]?: 1 | -1;
    };
}

export class Database<T extends {}> {
    protected filename: string;
    protected fullTextSearchFieldNames: (keyof T)[];

    constructor(filename: string, fullTextSearchFieldNames: (keyof T)[]) {
        this.filename = filename;
        this.fullTextSearchFieldNames = fullTextSearchFieldNames;
    }

    async find(query: Query<T>, options: Options<T>): Promise<Partial<T>[]> {
        const records = (await this.getRecords()).filter(this.getFilterFunction(query));
        let finalRecords: Partial<T>[] = records;
        if (options.projection) {
            finalRecords = records.map((record) => {
                const mappedRecord: Partial<T> = {};
                for (const field of Object.keys(options.projection!) as (keyof T)[]) {
                    if (options.projection![field] === 1) {
                        mappedRecord[field] = record[field];
                    }
                }
                return mappedRecord;
            })
        }
        if (options.sort) {
            finalRecords.sort((a, b) => {
                for (const field of Object.keys(options.sort!) as (keyof T)[]) {
                    const direction = options.sort![field];
                    if (a[field] < b[field]) {
                        return direction === 1 ? -1 : 1;
                    } else if (a[field] > b[field]) {
                        return direction === 1 ? 1 : -1;
                    }
                }
                return 0;
            })
        }
        return finalRecords;
    }

    private getFilterFunction(query: Query<T>): (record: T) => boolean {
        if ('$text' in query) {
            return ((record: T) => {
                for (const field of this.fullTextSearchFieldNames) {
                    const lowercaseWords = String(record[field]).split(/\s+/).map(s => s.toLowerCase());
                    if (lowercaseWords.includes(query.$text!.toLowerCase())) {
                        return true;
                    }
                }
                return false;
            })
        }
        if ('$and' in query) {
            const filters = query.$and!.map(query => this.getFilterFunction(query));
            return ((record) => {
                for (const filter of filters) {
                    if (!filter(record)) {
                        return false;
                    }
                }
                return true;
            })
        }
        if ('$or' in query) {
            const filters = query.$or!.map(query => this.getFilterFunction(query));
            return ((record) => {
                for (const filter of filters) {
                    if (filter(record)) {
                        return true;
                    }
                }
                return false;
            })
        }
        return (record) => {
            const keys = Object.keys(query) as (keyof PropertyQuery<T>)[];
            if (keys.length === 0) {
                return true;
            }
            for (const key of keys) {
                const value = query[key];
                if ('$in' in value) {
                    return (value.$in as T[keyof T][]).includes(record[key]);
                }
                if ('$eq' in value) {
                    console.log({value, record})
                    return value.$eq === record[key];
                }
                if ('$gt' in value) {
                    return record[key] > value.$gt;
                }
                if ('$lt' in value) {
                    return record[key] < value.$lt;
                }
            }
            throw new Error(`Unknown key-based filter: query=${JSON.stringify(query)}`);
        }
    }

    private async getRecords() {
        const records = [];
        const lines = (await fs.readFile(this.filename, 'utf-8')).trim().split('\n');
        for (const line of lines) {
            if (!line.startsWith('E')) {
                continue;
            }
            records.push(JSON.parse(line.replace(/^E/, '')) as T);
        }
        return records;
    }
}

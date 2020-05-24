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

type Record<T> = {
    deleted: boolean;
    data: T;
}

export class Database<T extends {}> {
    protected filename: string;
    protected fullTextSearchFieldNames: (keyof T)[];

    constructor(filename: string, fullTextSearchFieldNames: (keyof T)[]) {
        this.filename = filename;
        this.fullTextSearchFieldNames = fullTextSearchFieldNames;
    }

    async find(query: Query<T>, options?: Options<T>): Promise<Partial<T>[]> {
        const data = (await this.getActiveRecords()).map((record) => record.data).filter(this.getFilterFunction(query));
        let finalData: Partial<T>[] = data;
        if (options?.sort) {
            finalData.sort((a, b) => {
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
        if (options?.projection) {
            finalData = data.map((data) => {
                const mappedRecord: Partial<T> = {};
                for (const field of Object.keys(options.projection!) as (keyof T)[]) {
                    if (options.projection![field] === 1) {
                        mappedRecord[field] = data[field];
                    }
                }
                return mappedRecord;
            })
        }
        return finalData;
    }

    async insert(data: T) {
        await fs.appendFile(this.filename, `\nE${JSON.stringify(data)}`)
    }

    async delete(query: Query<T>) {
        const records = await this.getRecords();
        const filterFunction = this.getFilterFunction(query);
        for (const record of records) {
            if (record.deleted) {
                continue;
            }
            record.deleted = filterFunction(record.data);
        }
        this.writeRecords(records);
    }

    protected getFilterFunction(query: Query<T>): (record: T) => boolean {
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

    private async writeRecords(records: Record<T>[]) {
        const lines = records.map((record) => {
            return `${record.deleted ? 'D' : 'E'}${JSON.stringify(record.data)}`;
        })
        await fs.writeFile(this.filename, lines.join('\n'));
    }

    protected async getActiveRecords() {
        return (await this.getRecords()).filter((record) => !record.deleted)
    }

    protected async getRecords() {
        const lines = (await fs.readFile(this.filename, 'utf-8')).trim().split('\n');
        return lines.filter(line => !!line).map(this.parseRecord);
    }

    protected parseRecord(line: string): Record<T> {
        const json = line.substring(1);
        return {
            deleted: line.startsWith('D'),
            data: JSON.parse(json),
        };
    }
}

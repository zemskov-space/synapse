declare module 'sql.js' {
  export interface Statement {
    bind(values?: unknown[] | Record<string, unknown>): boolean;
    step(): boolean;
    getAsObject(params?: unknown[] | Record<string, unknown>): Record<string, unknown>;
    free(): boolean;
  }

  export interface QueryExecResult {
    columns: string[];
    values: unknown[][];
  }

  export class Database {
    constructor(data?: ArrayLike<number> | Buffer | null);
    run(sql: string, params?: unknown[] | Record<string, unknown>): this;
    exec(sql: string, params?: unknown[] | Record<string, unknown>): QueryExecResult[];
    getRowsModified(): number;
    prepare(sql: string, params?: unknown[] | Record<string, unknown>): Statement;
    export(): Uint8Array;
    close(): void;
  }

  export interface SqlJsStatic {
    Database: typeof Database;
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string;
  }): Promise<SqlJsStatic>;
}

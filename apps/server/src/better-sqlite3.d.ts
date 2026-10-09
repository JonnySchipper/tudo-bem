/** Minimal types for better-sqlite3 (the package ships no .d.ts). */
declare module 'better-sqlite3' {
  interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  interface Statement {
    run(...params: unknown[]): RunResult;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }

  interface Transaction<T> {
    (): T;
    immediate(): T;
  }

  interface Database {
    prepare(sql: string): Statement;
    exec(sql: string): this;
    pragma(source: string, options?: { simple?: boolean }): unknown;
    transaction<T>(fn: () => T): Transaction<T>;
    backup(filename: string): Promise<void>;
    close(): void;
    readonly open: boolean;
  }

  interface DatabaseOptions {
    readonly?: boolean;
    fileMustExist?: boolean;
    timeout?: number;
  }

  interface DatabaseConstructor {
    new (filename: string, options?: DatabaseOptions): Database;
    (filename: string, options?: DatabaseOptions): Database;
  }

  const Database: DatabaseConstructor;
  export default Database;
}

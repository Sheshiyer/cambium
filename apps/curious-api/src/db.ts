export interface SqlStatement {
  sql: string;
  params?: unknown[];
}

export interface CuriousDb {
  exec(sql: string): Promise<void>;
  all<T>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T>(sql: string, params?: unknown[]): Promise<T | null>;
  run(sql: string, params?: unknown[]): Promise<void>;
  batch(statements: SqlStatement[]): Promise<void>;
}

interface D1Prepared {
  bind(...values: unknown[]): D1Prepared;
  all<T>(): Promise<{ results?: T[] }>;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}

export interface D1Like {
  exec(query: string): Promise<unknown>;
  prepare(query: string): D1Prepared;
  batch(statements: D1Prepared[]): Promise<unknown>;
}

export function fromD1(db: D1Like): CuriousDb {
  return {
    async exec(sql) {
      await db.exec(sql);
    },
    async all<T>(sql: string, params: unknown[] = []) {
      const result = await db.prepare(sql).bind(...params).all<T>();
      return result.results ?? [];
    },
    async get(sql, params = []) {
      return (await db.prepare(sql).bind(...params).first()) ?? null;
    },
    async run(sql, params = []) {
      await db.prepare(sql).bind(...params).run();
    },
    async batch(statements) {
      if (statements.length === 0) return;
      await db.batch(statements.map((statement) => db.prepare(statement.sql).bind(...(statement.params ?? []))));
    },
  };
}

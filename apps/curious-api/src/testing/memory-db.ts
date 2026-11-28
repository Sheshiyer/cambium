import { readdir, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import type { CuriousDb } from "../db.ts";
import { applyMigrations } from "../migrations.ts";

export function fromSqlite(raw: DatabaseSync): CuriousDb {
  return {
    async exec(sql) {
      raw.exec(sql);
    },
    async all<T>(sql: string, params: unknown[] = []) {
      return raw.prepare(sql).all(...(params as never[])) as T[];
    },
    async get<T>(sql: string, params: unknown[] = []) {
      return (raw.prepare(sql).get(...(params as never[])) as T | undefined) ?? null;
    },
    async run(sql, params = []) {
      raw.prepare(sql).run(...(params as never[]));
    },
    async batch(statements) {
      raw.exec("BEGIN");
      try {
        for (const statement of statements) raw.prepare(statement.sql).run(...((statement.params ?? []) as never[]));
        raw.exec("COMMIT");
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
  };
}

export async function memoryDb(): Promise<CuriousDb> {
  const raw = new DatabaseSync(":memory:");
  const db = fromSqlite(raw);
  const dir = new URL("../../migrations/", import.meta.url);
  const names = (await readdir(dir)).filter((name) => name.endsWith(".sql")).sort();
  const files = await Promise.all(names.map(async (name) => ({ name, sql: await readFile(new URL(name, dir), "utf8") })));
  await applyMigrations(async (sql) => {
    raw.exec(sql);
  }, files);
  return db;
}

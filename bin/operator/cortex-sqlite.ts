// Cambium operator · cortex store on node:sqlite (M2 / B2, issue #16).
// Implements the CortexStore contract (B1) on Node's built-in SQLite — CodeGraph's backend:
// persistent, WAL concurrent reads, zero-dep (Node v26, no flag). This is the LOCAL / offline
// transport; the production shared store is Cloudflare Vectorize (B3). kNN is in-process via
// rankByCosine over tenant/kind-filtered candidate rows (per-tenant memory is small; Vectorize does
// native kNN at scale). init-on-start + fail-closed (mirrors CodeGraph's "not initialized").

import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { CortexStore, MemoryRecord, ScoredRecord, SearchOpts } from './cortex-memory.ts';
import { rankByCosine } from './cortex-memory.ts';

export interface SqliteCortexOpts {
  path?: string;        // db file (default ':memory:' — ephemeral, for tests)
}

interface Row { id: string; kind: string; tenant: string; vector: string; payload: string; ts: number; }

/** A CortexStore backed by node:sqlite. The vector is stored as JSON; kNN is computed in-process. */
export function sqliteCortex(opts: SqliteCortexOpts = {}): CortexStore {
  const path = opts.path ?? ':memory:';
  let db: DatabaseSync | null = null;

  const requireDb = (): DatabaseSync => {
    if (!db) throw new Error('sqliteCortex: not initialized — call init() at boot (fail-closed)');
    return db;
  };

  const where = (o: SearchOpts): { clause: string; params: string[] } => {
    const parts: string[] = [];
    const params: string[] = [];
    if (o.tenant) { parts.push('tenant = ?'); params.push(o.tenant); }
    if (o.kind) { parts.push('kind = ?'); params.push(o.kind); }
    return { clause: parts.length ? 'WHERE ' + parts.join(' AND ') : '', params };
  };

  return {
    init(): void {
      if (db) return;                                          // idempotent
      if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
      db = new DatabaseSync(path);
      db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');
      db.exec(`CREATE TABLE IF NOT EXISTS memory (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        tenant TEXT NOT NULL,
        vector TEXT NOT NULL,
        payload TEXT NOT NULL,
        ts INTEGER NOT NULL
      );`);
      db.exec('CREATE INDEX IF NOT EXISTS idx_memory_tenant_kind ON memory(tenant, kind);');
    },

    ready(): boolean { return db !== null; },

    upsert(record: MemoryRecord): void {
      requireDb().prepare(
        `INSERT INTO memory (id, kind, tenant, vector, payload, ts) VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           kind = excluded.kind, tenant = excluded.tenant, vector = excluded.vector,
           payload = excluded.payload, ts = excluded.ts`,
      ).run(
        record.id, record.kind, record.tenant,
        JSON.stringify(record.vector), JSON.stringify(record.payload), record.ts,
      );
    },

    search(vector: number[], k = 5, opts: SearchOpts = {}): ScoredRecord[] {
      const { clause, params } = where(opts);
      const rows = requireDb()
        .prepare(`SELECT id, kind, tenant, vector, payload, ts FROM memory ${clause}`)
        .all(...params) as Row[];
      const records: MemoryRecord[] = rows.map((r) => ({
        id: r.id,
        kind: r.kind as MemoryRecord['kind'],
        tenant: r.tenant,
        vector: JSON.parse(r.vector),
        payload: JSON.parse(r.payload),
        ts: r.ts,
      }));
      return rankByCosine(vector, records, k);                 // tenant/kind already filtered in SQL
    },

    count(opts: SearchOpts = {}): number {
      const { clause, params } = where(opts);
      const row = requireDb().prepare(`SELECT COUNT(*) AS n FROM memory ${clause}`).get(...params) as { n: number };
      return row.n;
    },

    close(): void { if (db) { db.close(); db = null; } },
  };
}

// Cambium operator · cortex memory contract (M2 / B1, issue #15).
// The frozen contract for the operator's SEMANTIC cross-run memory: a MemoryRecord, the search
// return shape, the ranking math, and the CortexStore interface (init-on-start, fail-closed).
// B2 (#16) implements CortexStore on node:sqlite — CodeGraph's backend: persistent, WAL, FTS5,
// zero-dep (Node v26 built-in). B3 (#17) swaps in real NIM 1024-d embeddings. CodeGraph
// code-recall (B6) is a SEPARATE structural lane — codegraph can't do cosine kNN over these vectors.

import { cosine } from './embed.ts';

/** What kind of remembered thing a record holds. */
export type MemoryKind = 'event' | 'decision' | 'deviation' | 'positioning' | 'pain';

const MEMORY_KINDS: readonly MemoryKind[] = ['event', 'decision', 'deviation', 'positioning', 'pain'];

/** One unit of the operator's semantic memory — an embedded situation it can match against later. */
export interface MemoryRecord {
  id: string;                          // stable id (e.g. `${tenant}:${kind}:${eventId}`)
  kind: MemoryKind;
  tenant: string;                      // multi-tenant isolation key (M3) — search never crosses it
  vector: number[];                    // the embedding (1024-d real NIM · 64-d offline stub)
  payload: Record<string, unknown>;    // the remembered content (summary, pain text, decision, …)
  ts: number;                          // epoch ms — passed in, so the store stays pure/deterministic in tests
}

/** A search hit: a record + its similarity to the query. score = cosine ∈ [-1, 1], higher = nearer. */
export interface ScoredRecord {
  record: MemoryRecord;
  score: number;
}

/** Optional filters for a search. */
export interface SearchOpts {
  tenant?: string;                     // restrict to one venture (M3 isolation)
  kind?: MemoryKind;                   // restrict to one memory kind
}

/**
 * The cortex store contract. B2 implements this on node:sqlite (init-on-start, WAL, fail-closed).
 * `init()` runs at operator boot; `ready()` is the fail-closed health gate (mirrors CodeGraph's
 * "not initialized" — never silently return empty on a dead store). `search` is kNN, desc by cosine.
 */
// Methods return `T | Promise<T>` so ONE seam fits both transports: node:sqlite (B2) is sync,
// Cloudflare Vectorize (B3) is async (HTTP). Callers `await` — a no-op on the sync local store.
export interface CortexStore {
  init(): void | Promise<void>;                                  // open/create the store (idempotent)
  ready(): boolean;                                              // health check — false ⇒ fail closed (sync)
  upsert(record: MemoryRecord): void | Promise<void>;            // write/replace by id
  search(vector: number[], k?: number, opts?: SearchOpts): ScoredRecord[] | Promise<ScoredRecord[]>;  // kNN, desc cosine
  count(opts?: SearchOpts): number | Promise<number>;
  close(): void | Promise<void>;
}

/** Deterministic ordering: higher score first, then lexicographic id (stable across runs/engines). */
function byScoreThenId(a: ScoredRecord, b: ScoredRecord): number {
  if (b.score !== a.score) return b.score - a.score;
  return a.record.id < b.record.id ? -1 : a.record.id > b.record.id ? 1 : 0;
}

/**
 * The ranking math the contract guarantees — pure, deterministic. B2's node:sqlite store fetches
 * candidate rows (optionally tenant/kind filtered) then ranks them through THIS, so the ordering
 * semantics live in one tested place. Dimension-mismatched vectors are skipped (mixed embedders).
 */
export function rankByCosine(
  query: number[], records: MemoryRecord[], k = 5, opts: SearchOpts = {},
): ScoredRecord[] {
  const scored: ScoredRecord[] = [];
  for (const record of records) {
    if (opts.tenant && record.tenant !== opts.tenant) continue;
    if (opts.kind && record.kind !== opts.kind) continue;
    if (record.vector.length !== query.length) continue;
    scored.push({ record, score: cosine(query, record.vector) });
  }
  return scored.sort(byScoreThenId).slice(0, Math.max(0, k));
}

/** Validate a record against the contract (used by writers + the contract test). */
export function isMemoryRecord(x: unknown): x is MemoryRecord {
  const r = x as MemoryRecord;
  return !!r && typeof r === 'object'
    && typeof r.id === 'string' && r.id.length > 0
    && typeof r.tenant === 'string'
    && typeof r.ts === 'number'
    && Array.isArray(r.vector)
    && typeof r.kind === 'string' && (MEMORY_KINDS as string[]).includes(r.kind)
    && typeof r.payload === 'object' && r.payload !== null;
}

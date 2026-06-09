// Cambium operator · cortex store on Cloudflare Vectorize (M2 / B3, issue #17).
// The PRODUCTION CortexStore — the shared I3 memory: native kNN over NIM 1024-d vectors at scale.
// Same injected seam as the local node:sqlite store (B2), but async (HTTP REST). NIM still embeds
// (embed.ts); Vectorize only stores + searches. Zero-dep (Node fetch). Fail-closed without creds.
//
// Provision once (see scripts/provision-vectorize.sh):
//   wrangler vectorize create cambium-cortex --dimensions=1024 --metric=cosine
//   wrangler vectorize create-metadata-index cambium-cortex --property-name=tenant --type=string
//   wrangler vectorize create-metadata-index cambium-cortex --property-name=kind   --type=string
// Auth: CLOUDFLARE_ACCOUNT_ID + a full-scope CLOUDFLARE_API_TOKEN in the env (NEVER in code/commits).

import type { CortexStore, MemoryRecord, ScoredRecord, SearchOpts } from './cortex-memory.ts';

export interface VectorizeOpts {
  accountId?: string;
  index?: string;
  apiToken?: string;
  apiBase?: string;
  fetchImpl?: typeof fetch;
}

const safeParse = (s: unknown): Record<string, unknown> => {
  try { return typeof s === 'string' && s ? JSON.parse(s) : {}; } catch { return {}; }
};

/** A CortexStore backed by Cloudflare Vectorize (v2 REST). Same contract as sqliteCortex — async. */
export function vectorizeCortex(opts: VectorizeOpts = {}): CortexStore {
  const account = opts.accountId ?? process.env.CLOUDFLARE_ACCOUNT_ID ?? '';
  const index = opts.index ?? process.env.CORTEX_INDEX ?? 'cambium-cortex';
  const token = opts.apiToken ?? process.env.CLOUDFLARE_API_TOKEN ?? '';
  const base = opts.apiBase ?? 'https://api.cloudflare.com/client/v4';
  const f = opts.fetchImpl ?? fetch;
  const root = `${base}/accounts/${account}/vectorize/v2/indexes/${index}`;
  const headers = (contentType: string) => ({ Authorization: `Bearer ${token}`, 'Content-Type': contentType });
  let _ready = false;

  return {
    async init(): Promise<void> {
      if (!account || !token) throw new Error('vectorizeCortex: missing CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN (fail-closed)');
      const res = await f(root, { headers: headers('application/json') });
      if (!res.ok) {
        throw new Error(`vectorizeCortex.init: index "${index}" not reachable (${res.status}) — provision it: ` +
          `wrangler vectorize create ${index} --dimensions=1024 --metric=cosine`);
      }
      _ready = true;
    },

    ready(): boolean { return _ready; },

    async upsert(record: MemoryRecord): Promise<void> {
      // Vectorize upsert body is NDJSON (one vector per line). Metadata values are scalars/strings,
      // so the payload object is stringified (and re-parsed on read).
      const line = JSON.stringify({
        id: record.id,
        values: record.vector,
        metadata: { kind: record.kind, tenant: record.tenant, ts: record.ts, payload: JSON.stringify(record.payload) },
      });
      const res = await f(`${root}/upsert`, { method: 'POST', headers: headers('application/x-ndjson'), body: line });
      if (!res.ok) throw new Error(`vectorizeCortex.upsert ${res.status}: ${(await res.text()).slice(0, 160)}`);
    },

    async search(vector: number[], k = 5, o: SearchOpts = {}): Promise<ScoredRecord[]> {
      const filter: Record<string, unknown> = {};
      if (o.tenant) filter.tenant = { $eq: o.tenant };       // tenant/kind must be metadata-indexed (see provision)
      if (o.kind) filter.kind = { $eq: o.kind };
      const body = JSON.stringify({ vector, topK: k, returnMetadata: 'all', ...(Object.keys(filter).length ? { filter } : {}) });
      const res = await f(`${root}/query`, { method: 'POST', headers: headers('application/json'), body });
      if (!res.ok) throw new Error(`vectorizeCortex.search ${res.status}: ${(await res.text()).slice(0, 160)}`);
      const data: any = await res.json();
      const matches: any[] = data?.result?.matches ?? [];
      return matches.map((m) => ({
        record: {
          id: String(m.id),
          kind: (m.metadata?.kind ?? 'decision') as MemoryRecord['kind'],
          tenant: String(m.metadata?.tenant ?? ''),
          vector: [],                              // Vectorize doesn't round-trip values by default; recall doesn't need them
          payload: safeParse(m.metadata?.payload),
          ts: Number(m.metadata?.ts ?? 0),
        },
        score: Number(m.score),
      }));
    },

    async count(): Promise<number> {
      const res = await f(`${root}/info`, { headers: headers('application/json') });
      if (!res.ok) return 0;
      const data: any = await res.json();
      return Number(data?.result?.vectorCount ?? 0);
    },

    close(): void { _ready = false; },
  };
}

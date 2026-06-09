// Quine hypha · cortex — the operator's semantic memory (NIM embeddings; node:sqlite local ·
// Cloudflare Vectorize production). Read = search the nearest past situations; write = remember a note.

import { join } from 'node:path';
import type { Hypha, QuineCtx } from '../types.ts';
import { flag, positional } from '../types.ts';
import { makeEmbedder } from '../../operator/embed.ts';
import { sqliteCortex } from '../../operator/cortex-sqlite.ts';
import { vectorizeCortex } from '../../operator/vectorize-cortex.ts';
import type { CortexStore, MemoryRecord } from '../../operator/cortex-memory.ts';

function pickStore(ctx: QuineCtx): { store: CortexStore; kind: string } {
  if (process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ACCOUNT_ID) {
    return { store: vectorizeCortex(), kind: 'vectorize' };
  }
  return { store: sqliteCortex({ path: join(ctx.root, '.operator', 'cortex.db') }), kind: 'sqlite' };
}

export const cortex: Hypha = {
  name: 'cortex',
  describe: 'semantic memory — search/write across runs (NIM · node:sqlite | Cloudflare Vectorize)',
  help: 'quine read cortex "<query>" [--tenant t] [--k 5]\n       quine write cortex "<text>" [--tenant t] [--kind decision]',

  async status(ctx) {
    const { store, kind } = pickStore(ctx);
    try {
      await store.init();
      const n = await store.count();
      return { name: 'cortex', reachable: true, detail: `${kind} · ${n} records` };
    } catch (e) {
      return { name: 'cortex', reachable: false, detail: (e as Error).message };
    }
  },

  async read(args, ctx) {
    const query = positional(args);
    const tenant = flag(args, '--tenant', 'thoughtseed');
    const k = Number(flag(args, '--k', '5'));
    const embedder = makeEmbedder({ root: ctx.root });
    const { store, kind } = pickStore(ctx);
    await store.init();
    const [vec] = await embedder.embed([query]);
    const hits = await store.search(vec, k, { tenant });
    return {
      hypha: 'cortex', transport: kind, embeddings: `${embedder.source}/${embedder.dims}d`, query, tenant,
      hits: hits.map((h) => ({ id: h.record.id, score: Number(h.score.toFixed(4)), kind: h.record.kind, payload: h.record.payload })),
    };
  },

  async write(args, ctx) {
    const text = positional(args);
    const tenant = flag(args, '--tenant', 'thoughtseed');
    const recKind = flag(args, '--kind', 'decision');
    const embedder = makeEmbedder({ root: ctx.root });
    const { store, kind } = pickStore(ctx);
    await store.init();
    const [vec] = await embedder.embed([text]);
    const id = `${tenant}:quine:${Date.now()}`;
    const record: MemoryRecord = { id, kind: recKind as MemoryRecord['kind'], tenant, vector: vec, payload: { text, via: 'quine' }, ts: Date.now() };
    await store.upsert(record);
    return { hypha: 'cortex', transport: kind, wrote: id, dims: vec.length };
  },
};

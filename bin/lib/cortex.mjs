// Cambium — the unified cortex client (I3). ONE interface to provider-neutral memory:
//   embed / search  ·  variable-contract read/write  ·  the why-handler deviation ledger.
//
// The transport is INJECTED. Today a working LOCAL transport (the deviation jsonl + a local
// variable-contract store). A hosted memory worker, NIM-compatible embedder, or any future provider
// swaps in as a transport with ZERO call-site changes. That is the whole point of I3: one interface,
// one tenant-scoped memory seam, so the why-handler's learning + the variable contracts are shared across organs.

import { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/** The cortex client — a thin façade over an injected transport. */
export function makeCortex(transport) {
  return {
    embed: (text) => transport.embed(text),
    search: (vec, k = 5) => transport.search(vec, k),
    readContract: (brand, group) => transport.readContract(brand, group),
    writeContract: (brand, group, data) => transport.writeContract(brand, group, data),
    writeDeviation: (record) => transport.writeDeviation(record),
  };
}

/**
 * The LOCAL transport (today): the deviation ledger (jsonl) + a local variable-contract store (fs).
 * embed / search need the NIM — they throw until I3's Cloudflare Worker provides them. fs is injectable.
 */
export const DEFAULT_TENANT = 'demo-org';

export function localTransport({ root, tenant = DEFAULT_TENANT, fs = { appendFileSync, readFileSync, writeFileSync, existsSync, mkdirSync } }) {
  // M3/C2 (issue #21): per-tenant namespacing. Contracts live under the BRAND's own
  // namespace (the brand arg IS the tenant): cortex/<brand>/contracts/<group>.json.
  // Deviations are path-isolated per transport tenant: cortex/<tenant>/deviations.jsonl.
  // Legacy flat paths (cortex/contracts/<brand>.<group>.json · root deviations.jsonl)
  // remain READ-fallbacks so pre-M3 state stays visible; all writes go tenant-scoped.
  const legacyContractPath = (brand, group) => join(root, 'cortex', 'contracts', `${brand}.${group}.json`);
  const contractDirFor = (brand) => join(root, 'cortex', brand, 'contracts');
  const contractPath = (brand, group) => join(contractDirFor(brand), `${group}.json`);
  const deviationsPath = join(root, 'cortex', tenant, 'deviations.jsonl');
  const needsWorker = (op) => () => {
    throw new Error(`cortex.${op}: needs an embedding/search transport (provider-neutral memory adapter)`);
  };
  return {
    embed: needsWorker('embed'),
    search: needsWorker('search'),
    writeContract: (brand, group, data) => {
      fs.mkdirSync(contractDirFor(brand), { recursive: true });
      fs.writeFileSync(contractPath(brand, group), JSON.stringify(data));
    },
    readContract: (brand, group) => {
      const p = contractPath(brand, group);
      if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf8'));
      const legacy = legacyContractPath(brand, group);
      return fs.existsSync(legacy) ? JSON.parse(fs.readFileSync(legacy, 'utf8')) : null;
    },
    writeDeviation: (line) => {
      // `line` is the recordDeviation() jsonl string — whyhandler serializes, the cortex persists
      fs.mkdirSync(join(root, 'cortex', tenant), { recursive: true });
      fs.appendFileSync(deviationsPath, line + '\n');
    },
  };
}

/** Convenience: the default cortex (local transport) rooted at the cambium repo.
 *  M3: pass the tenant so deviations land in that tenant's namespace. */
export function defaultCortex(root, tenant = DEFAULT_TENANT) {
  return makeCortex(localTransport({ root, tenant }));
}

/**
 * NVIDIA NIM transport (I3 — embed). Real 1024-dim embeddings via the NIM endpoint
 * (OpenAI-compatible); fs ops (contracts + the deviation ledger) delegate to the local transport.
 * `embed` accepts a string OR an array of strings → one vector OR an array of vectors.
 * `search` (a real kNN vector store) is the next I3 step — it stays the local throw for now.
 */
export function nimTransport({
  root,
  apiKey = process.env.NVIDIA_API_KEY,
  model = process.env.NIM_EMBED_MODEL || 'nvidia/nv-embedqa-e5-v5',
  url = 'https://integrate.api.nvidia.com/v1/embeddings',
  inputType = 'query',
  fetchImpl,
} = {}) {
  const local = localTransport({ root });
  const f = fetchImpl || globalThis.fetch;
  return {
    ...local,
    embed: async (input) => {
      if (!apiKey) throw new Error('nimTransport.embed: no NVIDIA_API_KEY');
      const texts = Array.isArray(input) ? input : [input];
      const res = await f(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: texts, model, input_type: inputType, encoding_format: 'float', truncate: 'END' }),
      });
      if (!res.ok) throw new Error(`nim embed ${res.status}: ${(await res.text()).slice(0, 160)}`);
      const data = await res.json();
      const vecs = (data.data || []).slice().sort((a, b) => a.index - b.index).map((d) => d.embedding);
      return Array.isArray(input) ? vecs : vecs[0];
    },
  };
}

/** The NIM-backed cortex (real embeddings; fs-backed contracts + ledger). */
export function nimCortex(root, opts = {}) {
  return makeCortex(nimTransport({ root, ...opts }));
}

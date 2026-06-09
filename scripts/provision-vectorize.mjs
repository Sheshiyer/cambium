#!/usr/bin/env node
// Provision the Cambium cortex on Cloudflare Vectorize (M2 / B3, issue #17) via the REST API.
// Uses the account-scoped token directly (avoids wrangler's user-level /memberships call, which an
// Account API Token can't make). Idempotent — re-running reports "already exists".
//
// Requires (NEVER commit these — read them from your shell env):
//   export CLOUDFLARE_API_TOKEN=...                                # full-scope, Vectorize R/W
//   export CLOUDFLARE_ACCOUNT_ID=9d9d23b27f32e70ae3afb6a1aa2c0f10
// Then:  node scripts/provision-vectorize.mjs
//
// After this, `node bin/operator/cli.ts demo` (with NVIDIA_API_KEY set for 1024-d NIM embeddings)
// writes + recalls via Vectorize; unset the CF vars to fall back to the local node:sqlite store.

const account = process.env.CLOUDFLARE_ACCOUNT_ID;
const token = process.env.CLOUDFLARE_API_TOKEN;
if (!account || !token) {
  console.error('Set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN in your env first (never commit them).');
  process.exit(1);
}
const INDEX = process.env.CORTEX_INDEX || 'cambium-cortex';
const base = `https://api.cloudflare.com/client/v4/accounts/${account}/vectorize/v2/indexes`;
const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

const post = async (url, body) => {
  const r = await fetch(url, { method: 'POST', headers: H, body: JSON.stringify(body) });
  return { ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) };
};
const errOf = (res) => JSON.stringify(res.j.errors ?? res.j.messages ?? res.j).slice(0, 180);

// 1 · the index (1024-d to match NIM nv-embedqa-e5-v5, cosine)
let res = await post(base, { name: INDEX, config: { dimensions: 1024, metric: 'cosine' } });
console.log(`create index ${INDEX} (1024-d cosine): ${res.ok ? 'OK' : `(${res.status}) ${errOf(res)}`}`);

// 2 · filterable metadata indexes for per-venture isolation (tenant) + lane (kind)
for (const propertyName of ['tenant', 'kind']) {
  res = await post(`${base}/${INDEX}/metadata_index/create`, { propertyName, indexType: 'string' });
  console.log(`metadata index ${propertyName}: ${res.ok ? 'OK' : `(${res.status}) ${errOf(res)}`}`);
}

// 3 · confirm
const info = await fetch(`${base}/${INDEX}`, { headers: H });
const ij = await info.json().catch(() => ({}));
console.log(`index info: ${info.ok ? JSON.stringify(ij.result) : `FAIL ${info.status} ${errOf({ j: ij })}`}`);

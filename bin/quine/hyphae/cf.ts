// Quine hypha · cf — Cloudflare (the cloud cambium already provisions). Read = Vectorize indexes +
// R2 buckets; write = provision the cortex Vectorize index. Uses the account-scoped REST token from
// env (CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID). Fail-closed without it. Never logs the token.

import type { Hypha } from '../types.ts';

const account = () => process.env.CLOUDFLARE_ACCOUNT_ID || '9d9d23b27f32e70ae3afb6a1aa2c0f10';
const token = () => process.env.CLOUDFLARE_API_TOKEN || '';

async function api(path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; j: any }> {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account()}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
  return { ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) };
}

export const cf: Hypha = {
  name: 'cf',
  describe: 'Cloudflare — Vectorize indexes + R2 buckets (read) · provision the cortex index (write)',
  help: 'quine read cf [vectorize|r2]\n       quine write cf provision   (create the cortex Vectorize index + metadata indexes)',

  async status() {
    if (!token()) return { name: 'cf', reachable: false, detail: 'no CLOUDFLARE_API_TOKEN in env' };
    const r = await api('/vectorize/v2/indexes');
    return { name: 'cf', reachable: r.ok, detail: r.ok ? `account ${account().slice(0, 8)}… reachable` : `auth ${r.status}` };
  },

  async read(args) {
    if (!token()) return { hypha: 'cf', error: 'no CLOUDFLARE_API_TOKEN (export it; never commit)' };
    const what = args[0] ?? 'vectorize';
    if (what === 'r2') {
      const r = await api('/r2/buckets');
      return { hypha: 'cf', r2: (r.j?.result?.buckets ?? []).map((b: any) => ({ name: b.name, created: b.creation_date })) };
    }
    const list = await api('/vectorize/v2/indexes');
    const indexes = (list.j?.result ?? []).map((i: any) => ({ name: i.name, dims: i.config?.dimensions, metric: i.config?.metric }));
    const info = await api('/vectorize/v2/indexes/cambium-cortex/info');
    return { hypha: 'cf', vectorize: { indexes, cortex: info.ok ? { vectorCount: info.j?.result?.vectorCount } : 'absent' } };
  },

  async write(args) {
    if (!token()) return { hypha: 'cf', error: 'no CLOUDFLARE_API_TOKEN' };
    if (args[0] !== 'provision') return { hypha: 'cf', error: 'usage: quine write cf provision' };
    const index = process.env.CORTEX_INDEX || 'cambium-cortex';
    const create = await api('/vectorize/v2/indexes', { method: 'POST', body: JSON.stringify({ name: index, config: { dimensions: 1024, metric: 'cosine' } }) });
    const metadata: string[] = [];
    for (const propertyName of ['tenant', 'kind']) {
      const m = await api(`/vectorize/v2/indexes/${index}/metadata_index/create`, { method: 'POST', body: JSON.stringify({ propertyName, indexType: 'string' }) });
      metadata.push(`${propertyName}:${m.ok ? 'ok' : m.status}`);
    }
    return { hypha: 'cf', provisioned: index, index: create.ok ? 'created' : `(${create.status})`, metadata };
  },
};

// cambium-quests · the serving store for the quest ledger (Thalia wing, W1).
// Pure handler — no Workers runtime imports — so node:test covers it like every
// other module in this repo. The thin fetch glue lives in index.ts.
//
// Doctrine carried over the wire: the API serves DERIVED ledgers only, inside an
// envelope {schema, derivedAt, source, tenant} so the UI can show real freshness
// (no fake liveness). Tenant gate: cambium only until M3's isolation suite is
// green (the quest log's own arc VII — the feature gates itself).

import { PAGE } from './page.ts';

export interface KvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface HandlerDeps {
  kv: KvLike;
  pushToken?: string;          // Worker secret QUESTS_PUSH_TOKEN (unset → push lane 503s)
}

export interface SimpleRequest {
  method: string;
  path: string;
  headers: Record<string, string>;   // lower-cased keys
  body?: string;
}

export interface SimpleResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

/** Tenants the API will serve. Hard-locked to cambium until M3 (C1–C4) ships its
 *  isolation suite — at which point arc VII flips and this list opens up. */
export const ALLOWED_TENANTS = ['cambium'];

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

const json = (status: number, value: unknown): SimpleResponse =>
  ({ status, headers: { ...JSON_HEADERS }, body: JSON.stringify(value) });

const ledgerKey = (tenant: string): string => `ledger:${tenant}`;

function tenantOf(path: string, prefix: string): string | null {
  if (!path.startsWith(prefix)) return null;
  const rest = path.slice(prefix.length).replace(/\/+$/, '');
  return /^[a-z0-9-]+$/.test(rest) ? rest : null;
}

export async function handle(req: SimpleRequest, deps: HandlerDeps): Promise<SimpleResponse> {
  const { method, path } = req;

  if (method === 'GET' && path === '/healthz') {
    return json(200, { ok: true, worker: 'cambium-quests' });
  }

  if (method === 'GET' && path.startsWith('/api/quests/')) {
    const tenant = tenantOf(path, '/api/quests/');
    if (!tenant) return json(400, { error: 'bad tenant' });
    if (!ALLOWED_TENANTS.includes(tenant)) {
      return json(403, { error: `tenant "${tenant}" is locked until the M3 isolation suite is green (quest arc VII)` });
    }
    const stored = await deps.kv.get(ledgerKey(tenant));
    if (!stored) return json(404, { error: `no ledger pushed yet for "${tenant}" — run: quine write quests push --tenant ${tenant}` });
    return { status: 200, headers: { ...JSON_HEADERS }, body: stored };
  }

  if (method === 'POST' && path.startsWith('/internal/ledger/')) {
    const tenant = tenantOf(path, '/internal/ledger/');
    if (!tenant) return json(400, { error: 'bad tenant' });
    if (!deps.pushToken) return json(503, { error: 'push token not configured on the worker' });
    const auth = req.headers['authorization'] ?? '';
    if (auth !== `Bearer ${deps.pushToken}`) return json(401, { error: 'bad or missing bearer' });
    if (!ALLOWED_TENANTS.includes(tenant)) {
      return json(403, { error: `tenant "${tenant}" is locked until the M3 isolation suite is green` });
    }
    let envelope: any;
    try { envelope = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
    for (const field of ['schema', 'derivedAt', 'source', 'tenant', 'ledger']) {
      if (envelope[field] === undefined) return json(400, { error: `envelope missing "${field}"` });
    }
    if (envelope.tenant !== tenant) return json(400, { error: 'envelope tenant mismatch' });
    const body = JSON.stringify(envelope);
    await deps.kv.put(ledgerKey(tenant), body);
    return json(200, { ok: true, tenant, bytes: body.length, derivedAt: envelope.derivedAt });
  }

  if (method === 'GET' && (path === '/' || path === '/index.html')) {
    return { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }, body: PAGE };
  }

  return json(404, { error: 'not found' });
}

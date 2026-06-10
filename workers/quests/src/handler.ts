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
  list(prefix: string): Promise<string[]>;   // key names under a prefix (gate queue)
}

export interface HandlerDeps {
  kv: KvLike;
  pushToken?: string;          // Worker secret QUESTS_PUSH_TOKEN (unset → push lane 503s)
  gate?: GateConfig;           // W4 founder gate (unset → gate lane 503s)
  uuid?: () => string;         // injectable for tests
}

// ── W4 · the founder gate: Telegram initData THIRD-PARTY validation ─────
// Ed25519 over the data-check string, verified with TELEGRAM'S PUBLIC KEY —
// zero secrets on this Worker (second pass F7). The bot token never leaves home.

export interface GateConfig {
  botId: string;                    // numeric bot id (non-secret, the token prefix)
  pubKeyHex: string;                // Telegram public Ed25519 key (prod constant) — injectable for tests
  founderIds: string[];             // the co-founder whitelist (same ids the commands use)
  maxAgeSec?: number;               // auth_date freshness window (default 600)
  now?: () => number;               // injectable clock
}

/** Telegram production public key for third-party initData validation. */
export const TELEGRAM_PROD_PUBKEY = 'e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d';

const hexToBytes = (hex: string): Uint8Array =>
  new Uint8Array((hex.match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)));

const b64urlToBytes = (s: string): Uint8Array => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

/** The data-check string for THIRD-PARTY validation: `<bot_id>:WebAppData\n` +
 *  sorted key=value lines, excluding `hash` and `signature`. */
export function buildDataCheckString(initData: string, botId: string): { dcs: string; fields: Record<string, string> } {
  const params = new URLSearchParams(initData);
  const fields: Record<string, string> = {};
  for (const [k, v] of params.entries()) fields[k] = v;
  const lines = Object.keys(fields)
    .filter((k) => k !== 'hash' && k !== 'signature')
    .sort()
    .map((k) => `${k}=${fields[k]}`);
  return { dcs: `${botId}:WebAppData\n${lines.join('\n')}`, fields };
}

export async function validateInitData(
  initData: string,
  cfg: GateConfig,
): Promise<{ ok: true; userId: string } | { ok: false; reason: string }> {
  if (!initData) return { ok: false, reason: 'missing initData (the gate opens inside Telegram)' };
  const { dcs, fields } = buildDataCheckString(initData, cfg.botId);
  if (!fields.signature) return { ok: false, reason: 'missing third-party signature' };
  const authDate = Number(fields.auth_date ?? 0);
  const now = (cfg.now ?? (() => Date.now()))() / 1000;
  const maxAge = cfg.maxAgeSec ?? 600;
  if (!authDate || now - authDate > maxAge) return { ok: false, reason: 'stale auth_date' };
  let verified = false;
  try {
    const key = await crypto.subtle.importKey('raw', hexToBytes(cfg.pubKeyHex), { name: 'Ed25519' }, false, ['verify']);
    verified = await crypto.subtle.verify('Ed25519', key, b64urlToBytes(fields.signature), new TextEncoder().encode(dcs));
  } catch {
    return { ok: false, reason: 'signature verification unavailable' };
  }
  if (!verified) return { ok: false, reason: 'bad signature' };
  let userId = '';
  try { userId = String(JSON.parse(fields.user ?? '{}').id ?? ''); } catch { /* fallthrough */ }
  if (!userId || !cfg.founderIds.includes(userId)) return { ok: false, reason: 'not a founder' };
  return { ok: true, userId };
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

  if (method === 'POST' && path.startsWith('/api/gate/')) {
    const tenant = tenantOf(path, '/api/gate/');
    if (!tenant) return json(400, { error: 'bad tenant' });
    if (!ALLOWED_TENANTS.includes(tenant)) return json(403, { error: 'tenant locked (M3 gate)' });
    if (!deps.gate) return json(503, { error: 'gate not configured' });
    let body: any;
    try { body = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
    if (!['approve', 'reroll'].includes(body.kind) || !body.subject) {
      return json(400, { error: 'need kind approve|reroll and subject' });
    }
    const verdict = await validateInitData(String(body.initData ?? ''), deps.gate);
    if (!verdict.ok) return json(401, { error: verdict.reason });
    const id = (deps.uuid ?? (() => crypto.randomUUID()))();
    const action = {
      id, ts: new Date().toISOString(), founderId: verdict.userId,
      kind: body.kind, subject: String(body.subject), note: body.note ? String(body.note).slice(0, 300) : null,
      status: 'queued',
    };
    await deps.kv.put(`gate:${tenant}:${id}`, JSON.stringify(action));
    return json(200, { queued: id, kind: action.kind, subject: action.subject });
  }

  if (method === 'GET' && path.startsWith('/internal/gate/') && !path.endsWith('/consume')) {
    const tenant = tenantOf(path, '/internal/gate/');
    if (!tenant) return json(400, { error: 'bad tenant' });
    if (!deps.pushToken) return json(503, { error: 'push token not configured on the worker' });
    if ((req.headers['authorization'] ?? '') !== `Bearer ${deps.pushToken}`) return json(401, { error: 'bad or missing bearer' });
    const keys = await deps.kv.list(`gate:${tenant}:`);
    const actions: unknown[] = [];
    for (const key of keys) {
      const stored = await deps.kv.get(key);
      if (!stored) continue;
      const action = JSON.parse(stored);
      if (action.status === 'queued') actions.push(action);
    }
    return json(200, { tenant, actions });
  }

  if (method === 'POST' && path.startsWith('/internal/gate/') && path.endsWith('/consume')) {
    const tenant = tenantOf(path.slice(0, -'/consume'.length), '/internal/gate/');
    if (!tenant) return json(400, { error: 'bad tenant' });
    if (!deps.pushToken) return json(503, { error: 'push token not configured on the worker' });
    if ((req.headers['authorization'] ?? '') !== `Bearer ${deps.pushToken}`) return json(401, { error: 'bad or missing bearer' });
    let body: any;
    try { body = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
    const key = `gate:${tenant}:${body.id}`;
    const stored = await deps.kv.get(key);
    if (!stored) return json(404, { error: 'unknown action' });
    const action = { ...JSON.parse(stored), status: 'consumed', result: body.result ?? null, consumedAt: new Date().toISOString() };
    await deps.kv.put(key, JSON.stringify(action));
    return json(200, { consumed: body.id });
  }

  if (method === 'GET' && (path === '/' || path === '/index.html')) {
    return { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }, body: PAGE };
  }

  return json(404, { error: 'not found' });
}

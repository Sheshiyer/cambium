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
  bridgeToken?: string;        // Worker secret BRIDGE_TOKEN — gates /v1/bridge/* (unset → 503)
  uuid?: () => string;         // injectable for tests
  now?: () => string;          // injectable clock (ISO) for the bridge
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

/** Tenant ID validation: lowercase kebab, no leading/trailing dash. The M3 isolation
 *  suite is green (arc VII complete) — the gate is open to all valid tenants. */
const VALID_TENANT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

const json = (status: number, value: unknown): SimpleResponse =>
  ({ status, headers: { ...JSON_HEADERS }, body: JSON.stringify(value) });

const ledgerKey = (tenant: string): string => `ledger:${tenant}`;

function tenantOf(path: string, prefix: string): string | null {
  if (!path.startsWith(prefix)) return null;
  const rest = path.slice(prefix.length).replace(/\/+$/, '');
  return VALID_TENANT.test(rest) ? rest : null;
}

export async function handle(req: SimpleRequest, deps: HandlerDeps): Promise<SimpleResponse> {
  const { method, path } = req;

  if (method === 'GET' && path === '/healthz') {
    return json(200, { ok: true, worker: 'cambium-quests' });
  }

  if (method === 'GET' && path.startsWith('/api/quests/')) {
    const tenant = tenantOf(path, '/api/quests/');
    if (!tenant) return json(400, { error: 'bad tenant' });
    // M3 isolation suite is green — gate open to all valid tenants
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
    // M3 isolation suite is green — gate open to all valid tenants
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

  // ── MultiCA ↔ Paperclip bridge ──────────────────────────────────────────
  // Hosted here because MultiCA's AWS backend has no /v1/bridge/* API. LISTEN:
  // Paperclip's upstream POSTs signed BridgeMessages to /ingest (stored in KV for
  // cofounders/MultiCA to read at /inbox). WRITE: cofounders/MultiCA enqueue
  // downstream directives at /directive; Paperclip's downstream polls /directives
  // and /ack's them (anti-redeliver; seeds the G1 reconnect handshake). A shared
  // BRIDGE_TOKEN gates every op; per-message HMAC (protocol.signature) is stored
  // for the G10 verification follow-up.
  if (path.startsWith('/v1/bridge/')) {
    if (!deps.bridgeToken) return json(503, { error: 'bridge not configured on the worker' });
    if ((req.headers['authorization'] ?? '') !== `Bearer ${deps.bridgeToken}`) {
      return json(401, { error: 'bad or missing bridge bearer' });
    }
    const nowIso = () => (deps.now ? deps.now() : new Date().toISOString());

    if (method === 'POST' && path === '/v1/bridge/ingest') {
      let msg: any;
      try { msg = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      for (const f of ['id', 'timestamp', 'direction', 'tenantId', 'memberId', 'payload']) {
        if (msg[f] === undefined) return json(400, { error: `message missing "${f}"` });
      }
      if (msg.direction !== 'upstream') return json(400, { error: 'ingest expects direction=upstream' });
      if (!VALID_TENANT.test(String(msg.tenantId))) return json(400, { error: 'bad tenantId' });
      await deps.kv.put(`bridge:up:${msg.tenantId}:${msg.id}`, JSON.stringify({ ...msg, receivedAt: nowIso() }));
      return json(200, { ok: true, id: msg.id, stored: true });
    }

    if (method === 'GET' && path.startsWith('/v1/bridge/inbox/')) {
      const tenant = tenantOf(path, '/v1/bridge/inbox/');
      if (!tenant) return json(400, { error: 'bad tenant' });
      const keys = await deps.kv.list(`bridge:up:${tenant}:`);
      const messages: any[] = [];
      for (const k of keys.slice(-100)) { const v = await deps.kv.get(k); if (v) messages.push(JSON.parse(v)); }
      return json(200, { tenant, count: messages.length, messages });
    }

    if (method === 'POST' && path === '/v1/bridge/directive') {
      let msg: any;
      try { msg = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      const memberId = msg.memberId ?? msg.payload?.target?.memberId;
      if (!memberId || !VALID_TENANT.test(String(memberId))) return json(400, { error: 'directive needs a valid memberId (top-level or payload.target.memberId)' });
      if (!msg.payload) return json(400, { error: 'directive needs a payload' });
      const id = msg.id ?? (deps.uuid ? deps.uuid() : `b_${memberId}_${nowIso()}`);
      const stored = { ...msg, id, memberId, direction: 'downstream', delivered: false, enqueuedAt: nowIso() };
      await deps.kv.put(`bridge:dir:${memberId}:${id}`, JSON.stringify(stored));
      return json(200, { ok: true, id, memberId, queued: true });
    }

    if (method === 'GET' && path.startsWith('/v1/bridge/directives/')) {
      const member = path.slice('/v1/bridge/directives/'.length).replace(/\/+$/, '');
      if (!VALID_TENANT.test(member)) return json(400, { error: 'bad member' });
      const keys = await deps.kv.list(`bridge:dir:${member}:`);
      const pending: any[] = [];
      for (const k of keys) { const v = await deps.kv.get(k); if (v) { const d = JSON.parse(v); if (!d.delivered) pending.push(d); } }
      return json(200, { member, count: pending.length, directives: pending });
    }

    if (method === 'POST' && path === '/v1/bridge/ack') {
      let body: any;
      try { body = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      const member = body.memberId; const ids = Array.isArray(body.ids) ? body.ids : [];
      if (!member || !ids.length) return json(400, { error: 'ack needs memberId + ids[]' });
      let acked = 0;
      for (const id of ids) {
        const key = `bridge:dir:${member}:${id}`;
        const v = await deps.kv.get(key);
        if (v) { const d = JSON.parse(v); d.delivered = true; d.deliveredAt = nowIso(); await deps.kv.put(key, JSON.stringify(d)); acked++; }
      }
      return json(200, { ok: true, acked });
    }

    return json(404, { error: `no bridge route for ${method} ${path}` });
  }

  if (method === 'POST' && path.startsWith('/api/gate/')) {
    const tenant = tenantOf(path, '/api/gate/');
    if (!tenant) return json(400, { error: 'bad tenant' });
    // M3 isolation suite is green — gate open to all valid tenants
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

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
  bridgeToken?: string;        // Worker secret BRIDGE_TOKEN — the admin/cofounder bridge token
  handoffSecret?: string;      // Worker secret HANDOFF_SECRET — signs invite links (unset → handoff 503)
  providerBroker?: ProviderBrokerConfig; // Worker secrets for hosted provider proxying (unset → provider lane 503s)
  uuid?: () => string;         // injectable for tests
  now?: () => string;          // injectable clock (ISO) for the bridge
  nowMs?: () => number;        // injectable epoch-ms clock for handoff TTLs
}

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  defaultModel?: string;
  models?: string[];
}

export interface ProviderBrokerConfig {
  token: string;
  providers: Record<string, ProviderConfig | undefined>;
  fetch?: typeof fetch;
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

type GateActionKind = 'approve' | 'reroll' | 'promote-skill' | 'queue-side-quest';

/** Telegram production public key for third-party initData validation. */
export const TELEGRAM_PROD_PUBKEY = 'e7bf03a2fa4602af4580703d88dda5bb59f32ed8b02a56c187fe7d34caed242d';

const hexToBytes = (hex: string): Uint8Array =>
  new Uint8Array((hex.match(/.{2}/g) ?? []).map((b) => parseInt(b, 16)));

const b64urlToBytes = (s: string): Uint8Array => {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

// ── Secure member handoff — crypto helpers (Web Crypto; runs in Workers + node) ──
const TEXT = new TextEncoder();
const TOKEN_TTL_MS = 30 * 24 * 3600 * 1000;   // per-member token: 30d → monthly rotation
const INVITE_TTL_MS = 7 * 24 * 3600 * 1000;   // invite link: 7d to redeem
const b64urlFromBytes = (bytes: Uint8Array): string => {
  let s = ''; for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
async function sha256hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', TEXT.encode(s) as unknown as BufferSource);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function hmacB64url(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', TEXT.encode(secret) as unknown as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, TEXT.encode(msg) as unknown as BufferSource);
  return b64urlFromBytes(new Uint8Array(sig));
}
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().filter((k) => record[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalJson(record[k])}`).join(',')}}`;
}
async function bridgeSignature(secret: string, msg: Record<string, unknown>): Promise<string> {
  const { signature: _signature, ...unsigned } = msg;
  return hmacB64url(secret, canonicalJson(unsigned));
}
function randomTokenHex(): string {
  return [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function signInvite(secret: string, claims: Record<string, unknown>): Promise<string> {
  const payload = b64urlFromBytes(TEXT.encode(JSON.stringify(claims)));
  return `${payload}.${await hmacB64url(secret, payload)}`;
}
async function verifyInvite(secret: string, token: string): Promise<Record<string, any> | null> {
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const payload = token.slice(0, dot), sig = token.slice(dot + 1);
  if (sig !== (await hmacB64url(secret, payload))) return null;
  try { return JSON.parse(new TextDecoder().decode(b64urlToBytes(payload))); } catch { return null; }
}
const memberKey = (id: string) => `member:${id}`;
const tokenIndexKey = (hash: string) => `memtok:${hash}`;
const inviteKey = (jti: string) => `invite:${jti}`;

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
const SOCIAL_OVERCLAIM_RE = /\b(leaderboard|social proof|popularity|rank|follower|viral)\b/i;

const json = (status: number, value: unknown): SimpleResponse =>
  ({ status, headers: { ...JSON_HEADERS }, body: JSON.stringify(value) });

const ledgerKey = (tenant: string): string => `ledger:${tenant}`;
const shortText = (value: unknown, fallback: string, max = 300): string => {
  const text = String(value ?? '').trim();
  return (text || fallback).slice(0, max);
};

function socialRowText(row: Record<string, unknown>): string {
  const evidence = Array.isArray(row.evidence) ? row.evidence : [];
  return [
    row.id,
    row.title,
    row.detail,
    row.proof,
    row.gap,
    ...evidence.flatMap((item) => {
      if (!item || typeof item !== 'object') return [];
      const ev = item as Record<string, unknown>;
      return [ev.label, ev.status, ev.detail];
    }),
  ].filter((item) => typeof item === 'string').join(' ');
}

function sanitizeQuestEnvelope(envelope: any): any {
  const rows = envelope?.social?.rows;
  if (!Array.isArray(rows)) return envelope;
  const safeRows = rows.filter((row) =>
    row && typeof row === 'object' && !Array.isArray(row) && !SOCIAL_OVERCLAIM_RE.test(socialRowText(row as Record<string, unknown>)),
  );
  if (safeRows.length === rows.length) return envelope;
  return {
    ...envelope,
    social: {
      ...envelope.social,
      status: safeRows.some((row: any) => row.state === 'ready') ? 'ready' : 'gap',
      rows: safeRows.length ? safeRows : [{
        id: 'social-gap',
        title: 'SOCIAL GAP',
        state: 'gap',
        detail: 'coordination rows rejected because they used generic social-proof language',
        proof: 'tenant handoff evidence must not be leaderboard, popularity, follower, rank, or social-proof copy',
        source: 'missing',
        scope: envelope.social.scope || 'tenant-handoff-only',
        evidence: [],
        gap: 'coordination evidence rejected',
      }],
      gap: safeRows.length ? envelope.social.gap : 'coordination evidence rejected',
    },
  };
}

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

  if (path === '/v1/providers' || path === '/v1/providers/health' || path.startsWith('/v1/providers/')) {
    return handleProviderBroker(req, deps);
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
    envelope = sanitizeQuestEnvelope(envelope);
    const body = JSON.stringify(envelope);
    await deps.kv.put(ledgerKey(tenant), body);
    return json(200, { ok: true, tenant, bytes: body.length, derivedAt: envelope.derivedAt });
  }

  // ── Founder ↔ Paperclip bridge ──────────────────────────────────────────
  // Hosted here so the curios.self mini app has the same gate/handoff surface. LISTEN:
  // Paperclip's upstream POSTs signed BridgeMessages to /ingest (stored in KV for
  // cofounders/Hermes to read at /inbox). WRITE: cofounders/Hermes enqueue
  // downstream directives at /directive; Paperclip's downstream polls /directives
  // and /ack's them (anti-redeliver; seeds the G1 reconnect handshake). The admin
  // BRIDGE_TOKEN or scoped member token gates each op; upstream messages must also
  // carry a per-message HMAC in protocol.signature so payload tampering fails shut.
  if (path.startsWith('/v1/bridge/')) {
    if (!deps.bridgeToken) return json(503, { error: 'bridge not configured on the worker' });
    // Resolve the principal: the admin BRIDGE_TOKEN (cofounders/Hermes, full access)
    // or a per-member token (scoped to one member, active + unexpired). Member tokens
    // are issued by the handoff invite flow and stored as SHA-256 in a memtok: index.
    const _auth = req.headers['authorization'] ?? '';
    const _tok = _auth.startsWith('Bearer ') ? _auth.slice(7) : '';
    let principal: { admin: boolean; memberId?: string; tenantId?: string } | null = null;
    if (_tok && _tok === deps.bridgeToken) {
      principal = { admin: true };
    } else if (_tok) {
      const tokenHash = await sha256hex(_tok);
      const mid = await deps.kv.get(tokenIndexKey(tokenHash));
      if (mid) {
        const raw = await deps.kv.get(memberKey(mid));
        if (raw) {
          const m = JSON.parse(raw);
          const nowMs = deps.nowMs ? deps.nowMs() : Date.now();
          if (m.status === 'active' && m.tokenHash === tokenHash && m.tokenExp && m.tokenExp > nowMs) {
            principal = { admin: false, memberId: mid, tenantId: m.tenantId };
          }
        }
      }
    }
    if (!principal) return json(401, { error: 'bad or missing bridge credential' });
    const mayAct = (mid: string) => principal!.admin || principal!.memberId === mid;
    const nowIso = () => (deps.now ? deps.now() : new Date().toISOString());

    if (method === 'POST' && path === '/v1/bridge/ingest') {
      let msg: any;
      try { msg = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
      for (const f of ['id', 'timestamp', 'direction', 'tenantId', 'memberId', 'payload']) {
        if (msg[f] === undefined) return json(400, { error: `message missing "${f}"` });
      }
      if (msg.direction !== 'upstream') return json(400, { error: 'ingest expects direction=upstream' });
      if (!VALID_TENANT.test(String(msg.tenantId))) return json(400, { error: 'bad tenantId' });
      if (!mayAct(String(msg.memberId))) return json(403, { error: 'token not scoped to this member' });
      if (!principal.admin && principal.tenantId !== String(msg.tenantId)) return json(403, { error: 'token not scoped to this tenant' });
      if (!msg.signature || msg.signature !== await bridgeSignature(_tok, msg)) return json(401, { error: 'bad or missing bridge signature' });
      await deps.kv.put(`bridge:up:${msg.tenantId}:${msg.id}`, JSON.stringify({ ...msg, receivedAt: nowIso() }));
      return json(200, { ok: true, id: msg.id, stored: true });
    }

    if (method === 'GET' && path.startsWith('/v1/bridge/inbox/')) {
      if (!principal.admin) return json(403, { error: 'inbox is cofounder-only' });
      const tenant = tenantOf(path, '/v1/bridge/inbox/');
      if (!tenant) return json(400, { error: 'bad tenant' });
      const keys = await deps.kv.list(`bridge:up:${tenant}:`);
      const messages: any[] = [];
      for (const k of keys.slice(-100)) { const v = await deps.kv.get(k); if (v) messages.push(JSON.parse(v)); }
      return json(200, { tenant, count: messages.length, messages });
    }

    if (method === 'POST' && path === '/v1/bridge/directive') {
      if (!principal.admin) return json(403, { error: 'only cofounders/Hermes may enqueue directives' });
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
      if (!mayAct(member)) return json(403, { error: 'token not scoped to this member' });
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
      if (!mayAct(member)) return json(403, { error: 'token not scoped to this member' });
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

  // ── Secure member handoff: invites → per-member bridge tokens → rotation ──
  // Admin ops (add/list/invite/revoke) need the BRIDGE_TOKEN; redeem/rotate are
  // public (gated by the signed invite / the member's current token). The issued
  // per-member token is what the member's Plexus uses for the scoped bridge auth.
  if (path.startsWith('/v1/handoff/')) {
    if (!deps.handoffSecret || !deps.bridgeToken) return json(503, { error: 'handoff not configured on the worker' });
    const nowMs = deps.nowMs ? deps.nowMs() : Date.now();
    const nowIso = () => (deps.now ? deps.now() : new Date().toISOString());
    const isAdmin = (req.headers['authorization'] ?? '') === `Bearer ${deps.bridgeToken}`;
    const readJson = (): any => { try { return JSON.parse(req.body ?? ''); } catch { return undefined; } };

    if (method === 'POST' && path === '/v1/handoff/members') {
      if (!isAdmin) return json(401, { error: 'admin token required' });
      const b = readJson(); if (!b) return json(400, { error: 'body is not JSON' });
      const memberId = String(b.memberId ?? '').toLowerCase(), email = String(b.email ?? '').toLowerCase();
      const tenantId = String(b.tenantId ?? memberId).toLowerCase();
      if (!VALID_TENANT.test(memberId)) return json(400, { error: 'memberId must be lowercase kebab' });
      if (!VALID_TENANT.test(tenantId)) return json(400, { error: 'tenantId must be lowercase kebab' });
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json(400, { error: 'a valid email is required' });
      const existing = await deps.kv.get(memberKey(memberId));
      const prev = existing ? JSON.parse(existing) : null;
      const member = { ...prev, memberId, tenantId, email, status: prev ? prev.status : 'invited',
        addedAt: prev ? prev.addedAt : nowIso(), updatedAt: nowIso() };
      await deps.kv.put(memberKey(memberId), JSON.stringify(member));
      return json(200, { ok: true, member: { memberId, tenantId, email, status: member.status } });
    }

    if (method === 'GET' && path === '/v1/handoff/members') {
      if (!isAdmin) return json(401, { error: 'admin token required' });
      const keys = await deps.kv.list('member:');
      const members: any[] = [];
      for (const k of keys) { const v = await deps.kv.get(k); if (v) { const m = JSON.parse(v);
        members.push({ memberId: m.memberId, tenantId: m.tenantId ?? m.memberId, email: m.email, status: m.status, tokenExpiresAt: m.tokenExp ? new Date(m.tokenExp).toISOString() : null }); } }
      return json(200, { count: members.length, members });
    }

    if (method === 'POST' && path === '/v1/handoff/invite') {
      if (!isAdmin) return json(401, { error: 'admin token required' });
      const b = readJson(); if (!b) return json(400, { error: 'body is not JSON' });
      const memberId = String(b.memberId ?? '').toLowerCase();
      const raw = await deps.kv.get(memberKey(memberId));
      if (!raw) return json(404, { error: 'member not in allowlist — POST /v1/handoff/members first' });
      const member = JSON.parse(raw);
      const jti = deps.uuid ? deps.uuid() : randomTokenHex().slice(0, 16);
      const exp = nowMs + INVITE_TTL_MS;
      const invite = await signInvite(deps.handoffSecret, { memberId, tenantId: member.tenantId ?? memberId, email: member.email, jti, exp });
      await deps.kv.put(inviteKey(jti), JSON.stringify({ jti, memberId, email: member.email, exp, used: false, createdAt: nowIso() }));
      const base = String(b.linkBase ?? 'https://curious.thoughtseed.space').replace(/\/+$/, '');
      return json(200, { ok: true, memberId, email: member.email, expiresAt: new Date(exp).toISOString(), invite, link: `${base}/join?t=${invite}` });
    }

    if (method === 'POST' && path === '/v1/handoff/revoke') {
      if (!isAdmin) return json(401, { error: 'admin token required' });
      const b = readJson(); if (!b) return json(400, { error: 'body is not JSON' });
      const memberId = String(b.memberId ?? '').toLowerCase();
      const raw = await deps.kv.get(memberKey(memberId));
      if (!raw) return json(404, { error: 'member not found' });
      const m = JSON.parse(raw);
      if (m.tokenHash) await deps.kv.put(tokenIndexKey(m.tokenHash), ''); // tombstone the token index
      m.status = 'revoked'; delete m.tokenHash; delete m.tokenExp; m.updatedAt = nowIso();
      await deps.kv.put(memberKey(memberId), JSON.stringify(m));
      return json(200, { ok: true, memberId, status: 'revoked' });
    }

    if (method === 'POST' && path === '/v1/handoff/redeem') {
      const b = readJson(); if (!b) return json(400, { error: 'body is not JSON' });
      const claims = await verifyInvite(deps.handoffSecret, String(b.invite ?? ''));
      if (!claims) return json(401, { error: 'invalid invite signature' });
      if (!claims.exp || claims.exp < nowMs) return json(401, { error: 'invite expired' });
      const invRaw = await deps.kv.get(inviteKey(claims.jti));
      if (!invRaw) return json(401, { error: 'unknown invite' });
      const inv = JSON.parse(invRaw);
      if (inv.used) return json(409, { error: 'invite already redeemed' });
      const raw = await deps.kv.get(memberKey(claims.memberId));
      if (!raw) return json(404, { error: 'member not found' });
      const m = JSON.parse(raw);
      if (m.status === 'revoked') return json(403, { error: 'member revoked' });
      if (claims.tenantId && m.tenantId && claims.tenantId !== m.tenantId) return json(403, { error: 'invite tenant mismatch' });
      const token = randomTokenHex(), tokenHash = await sha256hex(token), tokenExp = nowMs + TOKEN_TTL_MS;
      m.status = 'active'; m.tokenHash = tokenHash; m.tokenExp = tokenExp; m.redeemedAt = nowIso(); m.updatedAt = nowIso();
      await deps.kv.put(memberKey(claims.memberId), JSON.stringify(m));
      await deps.kv.put(tokenIndexKey(tokenHash), claims.memberId);
      inv.used = true; inv.usedAt = nowIso();
      await deps.kv.put(inviteKey(claims.jti), JSON.stringify(inv));
      return json(200, { ok: true, memberId: claims.memberId, tenantId: m.tenantId ?? claims.memberId, bridgeApiUrl: 'https://curious.thoughtseed.space', token, expiresAt: new Date(tokenExp).toISOString() });
    }

    if (method === 'POST' && path === '/v1/handoff/rotate') {
      const b = readJson(); if (!b) return json(400, { error: 'body is not JSON' });
      const cur = String(b.token ?? '');
      const memberId = cur ? await deps.kv.get(tokenIndexKey(await sha256hex(cur))) : null;
      if (!memberId) return json(401, { error: 'unknown or expired token' });
      const raw = await deps.kv.get(memberKey(memberId));
      if (!raw) return json(401, { error: 'member not found' });
      const m = JSON.parse(raw);
      if (m.status !== 'active') return json(403, { error: 'member not active' });
      if (m.tokenHash) await deps.kv.put(tokenIndexKey(m.tokenHash), '');
      const token = randomTokenHex(), tokenHash = await sha256hex(token), tokenExp = nowMs + TOKEN_TTL_MS;
      m.tokenHash = tokenHash; m.tokenExp = tokenExp; m.rotatedAt = nowIso(); m.updatedAt = nowIso();
      await deps.kv.put(memberKey(memberId), JSON.stringify(m));
      await deps.kv.put(tokenIndexKey(tokenHash), memberId);
      return json(200, { ok: true, memberId, token, expiresAt: new Date(tokenExp).toISOString() });
    }

    return json(404, { error: `no handoff route for ${method} ${path}` });
  }

  if (method === 'POST' && path.startsWith('/api/gate/')) {
    const tenant = tenantOf(path, '/api/gate/');
    if (!tenant) return json(400, { error: 'bad tenant' });
    // M3 isolation suite is green — gate open to all valid tenants
    if (!deps.gate) return json(503, { error: 'gate not configured' });
    let body: any;
    try { body = JSON.parse(req.body ?? ''); } catch { return json(400, { error: 'body is not JSON' }); }
    if (!['approve', 'reroll', 'promote-skill', 'queue-side-quest'].includes(body.kind) || !body.subject) {
      return json(400, { error: 'need kind approve|reroll|promote-skill|queue-side-quest and subject' });
    }
    const verdict = await validateInitData(String(body.initData ?? ''), deps.gate);
    if (!verdict.ok) return json(401, { error: verdict.reason });
    const kind = body.kind as GateActionKind;
    const subject = shortText(body.subject, 'unknown subject', 160);
    const idempotencyKey = shortText(body.idempotencyKey, `${kind}:${subject}`, 240);
    const existingKeys = await deps.kv.list(`gate:${tenant}:`);
    for (const key of existingKeys) {
      const stored = await deps.kv.get(key);
      if (!stored) continue;
      const existing = JSON.parse(stored);
      if (existing.status === 'queued' && existing.idempotencyKey === idempotencyKey) {
        return json(200, {
          queued: existing.id,
          duplicate: true,
          kind: existing.kind,
          subject: existing.subject,
          idempotencyKey,
          consequence: existing.consequence,
          reversibility: existing.reversibility,
        });
      }
    }
    const id = (deps.uuid ?? (() => crypto.randomUUID()))();
    const ts = deps.now ? deps.now() : new Date().toISOString();
    const action = {
      id, ts, founderId: verdict.userId,
      kind,
      subject,
      evidence: shortText(body.evidence, 'evidence not provided by gate item'),
      consequence: shortText(body.consequence, kind === 'approve'
        ? `approve ${subject}`
        : kind === 'promote-skill'
          ? `queue founder review to promote ${subject} to production`
          : kind === 'queue-side-quest'
            ? `queue side quest ${subject} for operator review`
          : `reroll ${subject}`),
      reversibility: shortText(body.reversibility, kind === 'approve'
        ? 'queued approval can be superseded until consumed'
        : kind === 'promote-skill'
          ? 'queued promotion can be superseded until consumed; registry remains unchanged until operator applies it'
          : kind === 'queue-side-quest'
            ? 'queued side quest can be superseded until consumed; side quest ledger remains unchanged until operator applies it'
          : 'reroll asks for revision before execution'),
      idempotencyKey,
      note: body.note ? String(body.note).slice(0, 300) : null,
      status: 'queued',
    };
    await deps.kv.put(`gate:${tenant}:${id}`, JSON.stringify(action));
    return json(200, {
      queued: id,
      duplicate: false,
      kind: action.kind,
      subject: action.subject,
      idempotencyKey,
      consequence: action.consequence,
      reversibility: action.reversibility,
    });
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

function providerAuth(req: SimpleRequest, token: string): boolean {
  const auth = req.headers['authorization'] ?? '';
  return auth === `Bearer ${token}`;
}

function configuredProviders(cfg: ProviderBrokerConfig): Array<Record<string, unknown>> {
  return Object.entries(cfg.providers)
    .filter(([, provider]) => provider?.apiKey && provider.baseUrl)
    .map(([id, provider]) => ({
      id,
      baseUrl: provider!.baseUrl.replace(/\/+$/, ''),
      defaultModel: provider!.defaultModel ?? null,
      models: provider!.models ?? [],
    }));
}

async function handleProviderBroker(req: SimpleRequest, deps: HandlerDeps): Promise<SimpleResponse> {
  const cfg = deps.providerBroker;
  if (!cfg?.token) return json(503, { error: 'provider broker not configured on the worker' });
  if (!providerAuth(req, cfg.token)) return json(401, { error: 'bad or missing provider broker credential' });

  if (req.method === 'GET' && (req.path === '/v1/providers' || req.path === '/v1/providers/health')) {
    const providers = configuredProviders(cfg);
    return json(200, {
      ok: true,
      broker: 'cambium-provider-broker',
      providers,
      count: providers.length,
    });
  }

  const match = req.path.match(/^\/v1\/providers\/([a-z0-9-]+)(?:\/(.*))?$/);
  if (!match) return json(404, { error: `no provider route for ${req.method} ${req.path}` });
  const providerId = match[1];
  const provider = cfg.providers[providerId];
  if (!provider?.apiKey || !provider.baseUrl) return json(404, { error: `unknown or unconfigured provider "${providerId}"` });

  const upstreamPath = match[2] || 'models';
  if (!/^[A-Za-z0-9_./:-]+$/.test(upstreamPath) || upstreamPath.includes('..')) {
    return json(400, { error: 'bad upstream provider path' });
  }
  if (!['GET', 'POST'].includes(req.method)) return json(405, { error: 'provider broker supports GET and POST only' });

  const baseUrl = provider.baseUrl.replace(/\/+$/, '');
  const upstreamUrl = `${baseUrl}/${upstreamPath.replace(/^\/+/, '')}`;
  const f = cfg.fetch ?? fetch;
  const upstream = await f(upstreamUrl, {
    method: req.method,
    headers: {
      authorization: `Bearer ${provider.apiKey}`,
      ...(req.method === 'POST' ? { 'content-type': req.headers['content-type'] ?? 'application/json' } : {}),
    },
    body: req.method === 'POST' ? req.body : undefined,
  });
  const contentType = upstream.headers.get('content-type') ?? 'application/json; charset=utf-8';
  const body = await upstream.text();
  return {
    status: upstream.status,
    headers: { 'content-type': contentType, 'cache-control': 'no-store' },
    body,
  };
}

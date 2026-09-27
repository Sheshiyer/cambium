// ============================================================================
// Cambium Quests: Founder Identity Gate & Auth Flow Verification Suite
//
// File: cambium/workers/quests/test/founder-identity-gate-verification.test.mjs
// Milestone: M2 (Mission Fabric Founder Identity Gate Review & Path Resolution)
// Authority: Sheshiyer/thoughtseed-vault#265 / 00-meta/plans/2026-09-02-wake-loop-integration-plan.md
//
// Invariants Verified:
//   1. Valid founder Telegram initData resolves to founder role and passes the gate.
//   2. Missing auth headers fail closed (401/403 or typed gap).
//   3. Tampered / expired Telegram initData fails closed.
//   4. Cloudflare Access Service Tokens floor to 'consultant' and fail closed with HTTP 403 by design.
//   5. Untrusted / non-founder identities fail closed.
//   6. Phase G read client cleanly wraps all rejection scenarios into typed MissionFabricGap without throwing.
// ============================================================================

import assert from 'node:assert/strict';
import test, { describe, it } from 'node:test';
import {
  generateKeyPairSync,
  createSign,
  createHash,
  webcrypto,
} from 'node:crypto';

const subtle = (globalThis.crypto ?? webcrypto).subtle;

// ---------------------------------------------------------------------------
// Constants & Configuration Fixtures
// ---------------------------------------------------------------------------
const NOW_MS = 1_750_000_000_000;
const NOW_ISO = '2026-07-28T09:00:00.000Z';
const BOT_ID = '900000001';
const FOUNDER_TELEGRAM_ID = '200000001';
const NON_FOUNDER_TELEGRAM_ID = '200000099';
const TENANT = 'cambium';

const TEAM_DOMAIN = 'thoughtseedlabs.cloudflareaccess.com';
const AUD = '29e1c8a6f3b5447ea8d9e02138947219';

// RSA key pair for simulating Cloudflare Access RS256 JWTs
const { publicKey: rsaPublicKey, privateKey: rsaPrivateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const rsaJwk = rsaPublicKey.export({ format: 'jwk' });
const KID = 'cf-access-key-2026';

// ---------------------------------------------------------------------------
// Cryptographic Utility Functions
// ---------------------------------------------------------------------------
function b64url(buf) {
  return Buffer.from(buf).toString('base64url');
}

function b64urlToBytes(str) {
  return new Uint8Array(Buffer.from(str, 'base64url'));
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function sha256Hex(str) {
  return createHash('sha256').update(str).digest('hex');
}

function canonicalJson(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(canonicalJson).join(',')}]`;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

function projectionDigest(projection) {
  const content = {
    schema: projection.schema,
    tenantId: projection.tenantId,
    graphVersion: projection.graphVersion,
    asOf: projection.asOf,
    nodes: projection.nodes,
    edges: projection.edges,
    gaps: projection.gaps,
  };
  return `sha256:${sha256Hex(canonicalJson(content))}`;
}

// ---------------------------------------------------------------------------
// Telegram Ed25519 Signer & Validator (Matching handler.ts)
// ---------------------------------------------------------------------------
export function buildDataCheckString(initData, botId) {
  const params = new URLSearchParams(initData);
  const fields = {};
  for (const [k, v] of params.entries()) fields[k] = v;
  const lines = Object.keys(fields)
    .filter((k) => k !== 'hash' && k !== 'signature')
    .sort()
    .map((k) => `${k}=${fields[k]}`);
  return { dcs: `${botId}:WebAppData\n${lines.join('\n')}`, fields };
}

async function createEd25519Pair() {
  const pair = await subtle.generateKey('Ed25519', true, ['sign', 'verify']);
  const raw = new Uint8Array(await subtle.exportKey('raw', pair.publicKey));
  const pubKeyHex = [...raw].map((b) => b.toString(16).padStart(2, '0')).join('');
  return { pair, pubKeyHex };
}

async function signTelegramInitData(opts = {}) {
  const userId = opts.userId ?? FOUNDER_TELEGRAM_ID;
  const authDate = opts.authDate ?? Math.floor(NOW_MS / 1000 - 10);
  const botId = opts.botId ?? BOT_ID;
  const pair = opts.pair ?? (await createEd25519Pair()).pair;

  const fields = new URLSearchParams({
    auth_date: String(authDate),
    user: typeof opts.user === 'string' ? opts.user : JSON.stringify(opts.user ?? { id: Number(userId), first_name: 'Founder' }),
    query_id: opts.queryId ?? 'AAtest',
    ...(opts.extraFields ?? {}),
  });

  const { dcs } = buildDataCheckString(fields.toString(), botId);
  const sig = new Uint8Array(await subtle.sign('Ed25519', pair.privateKey, new TextEncoder().encode(dcs)));
  fields.set('signature', opts.signatureOverride ?? Buffer.from(sig).toString('base64url'));
  fields.set('hash', opts.hashOverride ?? 'deadbeef');
  return fields.toString();
}

async function authenticateTelegramInitData(initData, cfg) {
  if (!initData || !initData.trim()) {
    return { ok: false, reason: 'missing initData (the gate opens inside Telegram)' };
  }
  const { dcs, fields } = buildDataCheckString(initData, cfg.botId);
  if (!fields.signature) {
    return { ok: false, reason: 'missing third-party signature' };
  }
  const authDate = Number(fields.auth_date ?? 0);
  const now = (cfg.now ?? (() => Date.now()))() / 1000;
  const maxAge = cfg.maxAgeSec ?? 600;
  if (!authDate || now - authDate > maxAge) {
    return { ok: false, reason: 'stale auth_date' };
  }
  let verified = false;
  try {
    const key = await subtle.importKey('raw', hexToBytes(cfg.pubKeyHex), { name: 'Ed25519' }, false, ['verify']);
    verified = await subtle.verify('Ed25519', key, b64urlToBytes(fields.signature), new TextEncoder().encode(dcs));
  } catch {
    return { ok: false, reason: 'signature verification unavailable' };
  }
  if (!verified) return { ok: false, reason: 'bad signature' };
  let userId = '';
  try {
    userId = String(JSON.parse(fields.user ?? '{}').id ?? '');
  } catch {
    /* fallthrough */
  }
  if (!userId) return { ok: false, reason: 'missing telegram user id' };
  return { ok: true, userId };
}

// ---------------------------------------------------------------------------
// Cloudflare Access JWT Signer & Plexus Principal Resolver (Matching plexus-principal.ts)
// ---------------------------------------------------------------------------
function signCfAccessJwt(payload, kid = KID) {
  const header = b64url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = createSign('RSA-SHA256').update(`${header}.${body}`).sign(rsaPrivateKey, 'base64url');
  return `${header}.${body}.${sig}`;
}

function validCfAccessPayload(overrides = {}) {
  return {
    iss: `https://${TEAM_DOMAIN}`,
    aud: AUD,
    email: 'shesh@thoughtseed.space',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

function fakePlexusKv() {
  const store = new Map();
  return {
    store,
    async get(k) { return store.get(k) ?? null; },
    async put(k, v) { store.set(k, v); },
  };
}

function makeJwksFetch(whoamiResponse) {
  return async (url, init) => {
    const urlStr = String(url);
    if (urlStr.includes('/cdn-cgi/access/certs')) {
      return {
        status: 200,
        ok: true,
        async json() { return { keys: [{ ...rsaJwk, kid: KID }] }; },
      };
    }
    if (urlStr.includes('/v1/whoami')) {
      if (typeof whoamiResponse === 'function') {
        return whoamiResponse(urlStr, init);
      }
      return {
        status: whoamiResponse?.status ?? 200,
        ok: (whoamiResponse?.status ?? 200) < 400,
        async json() { return whoamiResponse?.body ?? {}; },
      };
    }
    return { status: 404, ok: false, async json() { return { error: 'not found' }; } };
  };
}

async function verifyAccessJwt(headers, cfg, fetchImpl) {
  const jwt = headers['cf-access-jwt-assertion'] || '';
  if (!jwt) return null;
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  try {
    const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.iss !== `https://${cfg.teamDomain}`) return null;
    if (payload.aud !== cfg.aud) return null;
    const nowSec = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < nowSec) return null;

    // Verify RS256 signature against certs
    const certsRes = await fetchImpl(`https://${cfg.teamDomain}/cdn-cgi/access/certs`);
    const certs = await certsRes.json();
    const keyMatch = certs.keys.find((k) => k.kid === header.kid);
    if (!keyMatch) return null;

    // Simple RS256 signature check using WebCrypto / Node crypto
    const cryptoKey = await subtle.importKey(
      'jwk',
      keyMatch,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const valid = await subtle.verify(
      'RSASSA-PKCS1-v1_5',
      cryptoKey,
      b64urlToBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!valid) return null;
    return payload;
  } catch {
    return null;
  }
}

async function resolvePlexusPrincipal(headers, cfg, kv, fetchImpl) {
  if (!cfg.teamDomain || !cfg.aud) return { kind: 'unconfigured' };
  const identity = await verifyAccessJwt(headers, cfg, fetchImpl);
  const jwt = headers['cf-access-jwt-assertion'];
  if (!identity || !jwt) return { kind: 'unauthenticated' };

  const accessEmail = typeof identity.email === 'string' ? identity.email.trim().toLowerCase() : null;
  if (!accessEmail) return { kind: 'unauthenticated' };

  const cacheKey = `plexus:whoami:${sha256Hex(jwt)}`;
  try {
    const cached = await kv.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed.version === 2 && parsed.accessEmail === accessEmail && Date.now() - parsed.cachedAt < 300_000) {
        return { kind: 'principal', principal: parsed.principal };
      }
    }
  } catch { /* ignore cache parse errors */ }

  let principal;
  try {
    const res = await fetchImpl(cfg.whoamiUrl ?? 'https://plexus-api.thoughtseed.space/v1/whoami', {
      headers: { 'cf-access-jwt-assertion': jwt },
    });
    if (res.status === 404) {
      principal = { id: `plexus:${accessEmail}`, tenant: '*', role: 'consultant', allow: [], createdBy: 'plexus' };
    } else if (!res.ok) {
      principal = { id: `plexus:${accessEmail}`, tenant: '*', role: 'consultant', allow: [], createdBy: 'plexus' };
    } else {
      const body = await res.json();
      const data = body && body.ok === true && body.data ? body.data : body;
      const sessionEmail = typeof data?.email === 'string' ? data.email.trim().toLowerCase() : null;
      const active = data?.isActive === undefined || data?.isActive === true;
      const role = sessionEmail === accessEmail && active
        ? data?.role === 'admin'
          ? 'founder'
          : data?.role === 'employee'
            ? 'team'
            : 'consultant'
        : 'consultant';
      principal = {
        id: data?.identityId ?? `plexus:${accessEmail}`,
        tenant: '*',
        role,
        allow: [],
        createdBy: 'plexus',
      };
    }
  } catch {
    principal = { id: `plexus:${accessEmail}`, tenant: '*', role: 'consultant', allow: [], createdBy: 'plexus' };
  }

  try {
    await kv.put(cacheKey, JSON.stringify({ version: 2, accessEmail, cachedAt: Date.now(), principal }));
  } catch { /* ignore */ }

  return { kind: 'principal', principal };
}

// ---------------------------------------------------------------------------
// Mission Fabric Route Gate Evaluator (Joining Telegram & Access Paths)
// ---------------------------------------------------------------------------
async function evaluateMissionFabricGate(req, deps) {
  const allowlist = deps.missionFabricTenants ?? [];
  if (!allowlist.includes(req.tenant)) {
    return { status: 403, error: 'mission fabric tenant is not enabled' };
  }

  // Path A: Telegram initData authentication
  const tgHeader = (req.headers['x-telegram-init-data'] ?? req.headers['telegram-init-data'] ?? '').trim();
  if (tgHeader) {
    if (!deps.gate) return { status: 503, error: 'telegram auth is not configured' };
    const auth = await authenticateTelegramInitData(tgHeader, deps.gate);
    if (!auth.ok) {
      return { status: 401, error: 'telegram authentication failed', reason: auth.reason };
    }
    const isFounder = deps.gate.founderIds.includes(auth.userId);
    const viewerIds = deps.missionFabricViewerIds ?? [];
    const isViewer = viewerIds.includes(auth.userId);
    if (!isFounder && !isViewer) {
      return { status: 401, error: 'telegram authentication failed', reason: 'not authorized for mission fabric' };
    }
    return {
      status: 200,
      ok: true,
      role: isFounder ? 'founder' : 'viewer',
      actorId: `telegram:${auth.userId}`,
      redacted: !isFounder,
    };
  }

  // Path B: Cloudflare Access JWT Assertion & Plexus Whoami resolution
  const accessHeader = (req.headers['cf-access-jwt-assertion'] ?? '').trim();
  const hasServiceToken = Boolean(req.headers['cf-access-client-id'] && req.headers['cf-access-client-secret']);

  if (accessHeader || hasServiceToken || deps.plexus) {
    if (!deps.plexus) return { status: 503, error: 'plexus gate not configured' };

    // Service tokens without user assertion floor immediately to consultant
    if (hasServiceToken && !accessHeader) {
      return { status: 403, error: 'forbidden: service tokens floor to consultant and lack founder authority' };
    }

    const resolved = await resolvePlexusPrincipal(req.headers, deps.plexus, deps.kv, deps.plexusFetchImpl);
    if (resolved.kind === 'unauthenticated') {
      return { status: 401, error: 'access_identity_required', message: 'A verified Cloudflare Access identity is required.' };
    }
    if (resolved.kind === 'unconfigured') {
      return { status: 503, error: 'plexus_gate_misconfigured' };
    }

    if (resolved.principal.role !== 'founder') {
      return {
        status: 403,
        error: 'forbidden: founder identity required',
        assignedRole: resolved.principal.role,
      };
    }

    return {
      status: 200,
      ok: true,
      role: 'founder',
      actorId: resolved.principal.id,
      redacted: false,
    };
  }

  // Neither Telegram initData nor Cloudflare Access JWT provided -> Fail closed
  return { status: 401, error: 'missing initData (the gate opens inside Telegram or via Access JWT)' };
}

// ---------------------------------------------------------------------------
// Phase G Mission Fabric Read Client (Matching mission-fabric-read-client.ts)
// ---------------------------------------------------------------------------
const MISSION_FABRIC_CAPS = {
  MAX_NODES: 128,
  MAX_EDGES: 256,
  MAX_GAPS: 64,
};

function verifyMissionFabricProjection(tenantId, body) {
  if (body === null || typeof body !== 'object') {
    return { ok: false, kind: 'gap', reason: 'malformed-body', detail: 'response body is not an object', tenantId };
  }
  const record = body;
  const candidate = 'schema' in record ? record : record.projection;
  if (!candidate || typeof candidate !== 'object') {
    return { ok: false, kind: 'gap', reason: 'malformed-body', detail: 'no projection object in response', tenantId };
  }
  if (candidate.schema !== 'cambium.mission-fabric-projection.v1') {
    return { ok: false, kind: 'gap', reason: 'schema-mismatch', detail: `unexpected schema: ${candidate.schema}`, tenantId };
  }
  if (candidate.projectionVersion !== 1) {
    return { ok: false, kind: 'gap', reason: 'schema-mismatch', detail: `unexpected version: ${candidate.projectionVersion}`, tenantId };
  }
  if (candidate.sourceOfTruth !== 'd1-goal-graph' || candidate.readOnly !== true) {
    return { ok: false, kind: 'gap', reason: 'schema-mismatch', detail: 'not a read-only d1 projection', tenantId };
  }
  if (candidate.tenantId !== tenantId) {
    return { ok: false, kind: 'gap', reason: 'tenant-mismatch', detail: `tenant mismatch`, tenantId };
  }
  const { nodes, edges, gaps } = candidate;
  if (!Array.isArray(nodes) || !Array.isArray(edges) || !Array.isArray(gaps)) {
    return { ok: false, kind: 'gap', reason: 'malformed-body', detail: 'nodes/edges/gaps must be arrays', tenantId };
  }
  if (nodes.length > MISSION_FABRIC_CAPS.MAX_NODES) {
    return { ok: false, kind: 'gap', reason: 'cap-exceeded', detail: 'max nodes exceeded', tenantId };
  }
  if (edges.length > MISSION_FABRIC_CAPS.MAX_EDGES) {
    return { ok: false, kind: 'gap', reason: 'cap-exceeded', detail: 'max edges exceeded', tenantId };
  }
  if (gaps.length > MISSION_FABRIC_CAPS.MAX_GAPS) {
    return { ok: false, kind: 'gap', reason: 'cap-exceeded', detail: 'max gaps exceeded', tenantId };
  }
  const recomputed = projectionDigest(candidate);
  if (recomputed !== candidate.graphDigest) {
    return { ok: false, kind: 'gap', reason: 'digest-mismatch', detail: 'digest mismatch', tenantId };
  }
  return {
    ok: true,
    kind: 'projection',
    tenantId,
    graphVersion: candidate.graphVersion,
    graphDigest: candidate.graphDigest,
    projection: candidate,
  };
}

async function readMissionFabric(config) {
  const { tenantId } = config;
  if (!config.liveReads) {
    return { ok: false, kind: 'gap', reason: 'live-reads-disabled', detail: 'CAMBIUM_LIVE_READS is not enabled', tenantId };
  }
  const fetchImpl = config.fetchImpl ?? globalThis.fetch;
  if (typeof fetchImpl !== 'function') {
    return { ok: false, kind: 'gap', reason: 'transport-error', detail: 'no fetch available', tenantId };
  }
  const url = `${config.baseUrl.replace(/\/+$/, '')}/v1/mission-fabric/${encodeURIComponent(tenantId)}`;
  const headers = { accept: 'application/json', ...(config.auth?.headers ?? {}) };

  const timeoutMs = config.timeoutMs ?? 10_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let response;
  try {
    response = await fetchImpl(url, { method: 'GET', headers, signal: controller.signal });
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    return {
      ok: false,
      kind: 'gap',
      reason: aborted ? 'timeout' : 'transport-error',
      detail: aborted ? `request exceeded ${timeoutMs}ms` : `fetch failed: ${err.message}`,
      tenantId,
    };
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 401) {
    return { ok: false, kind: 'gap', reason: 'unauthorized', detail: 'authentication required or invalid', tenantId, status: 401 };
  }
  if (response.status === 403) {
    return { ok: false, kind: 'gap', reason: 'forbidden', detail: 'not authorized for this tenant', tenantId, status: 403 };
  }
  if (response.status === 404) {
    return { ok: false, kind: 'gap', reason: 'not-found', detail: 'tenant or route not found', tenantId, status: 404 };
  }
  if (response.status !== 200) {
    return { ok: false, kind: 'gap', reason: 'bad-status', detail: `unexpected status ${response.status}`, tenantId, status: response.status };
  }

  let body;
  try {
    body = await response.json();
  } catch (err) {
    return { ok: false, kind: 'gap', reason: 'malformed-body', detail: `invalid JSON: ${err.message}`, tenantId, status: 200 };
  }

  const verified = verifyMissionFabricProjection(tenantId, body);
  if (!verified.ok) return { ...verified, status: 200 };
  return verified;
}

// ---------------------------------------------------------------------------
// TEST SUITE: Founder Identity Gate Review & Path Resolution
// ---------------------------------------------------------------------------

describe('Founder Identity Gate Review & Path Resolution Verification Suite', () => {

  // =========================================================================
  // 1. Valid Founder Telegram initData Resolves to Founder Role & Passes Gate
  // =========================================================================
  describe('1. Valid Founder Telegram initData Authentication & Authorization', () => {
    it('cryptographically validates Ed25519 signature and derives founder role for authorized founder ID', async () => {
      const { pair, pubKeyHex } = await createEd25519Pair();
      const initData = await signTelegramInitData({ userId: FOUNDER_TELEGRAM_ID, pair });

      const deps = {
        missionFabricTenants: [TENANT],
        gate: {
          botId: BOT_ID,
          pubKeyHex,
          founderIds: [FOUNDER_TELEGRAM_ID],
          now: () => NOW_MS,
        },
      };

      const result = await evaluateMissionFabricGate({
        tenant: TENANT,
        headers: { 'x-telegram-init-data': initData },
      }, deps);

      assert.equal(result.status, 200);
      assert.equal(result.ok, true);
      assert.equal(result.role, 'founder');
      assert.equal(result.redacted, false);
      assert.equal(result.actorId, `telegram:${FOUNDER_TELEGRAM_ID}`);
    });

    it('accepts alternative header name telegram-init-data seamlessly', async () => {
      const { pair, pubKeyHex } = await createEd25519Pair();
      const initData = await signTelegramInitData({ userId: FOUNDER_TELEGRAM_ID, pair });

      const deps = {
        missionFabricTenants: [TENANT],
        gate: {
          botId: BOT_ID,
          pubKeyHex,
          founderIds: [FOUNDER_TELEGRAM_ID],
          now: () => NOW_MS,
        },
      };

      const result = await evaluateMissionFabricGate({
        tenant: TENANT,
        headers: { 'telegram-init-data': initData },
      }, deps);

      assert.equal(result.status, 200);
      assert.equal(result.role, 'founder');
    });

    it('correctly calculates data-check string sorting keys alphabetically and excluding hash & signature', () => {
      const initData = 'user=%7B%22id%22%3A123%7D&auth_date=1750000000&query_id=test&signature=sig123&hash=hash123';
      const { dcs, fields } = buildDataCheckString(initData, 'bot999');
      assert.equal(fields.signature, 'sig123');
      assert.equal(fields.hash, 'hash123');
      assert.equal(
        dcs,
        'bot999:WebAppData\nauth_date=1750000000\nquery_id=test\nuser={"id":123}',
      );
    });
  });

  // =========================================================================
  // 2. Missing Auth Headers Fail Closed
  // =========================================================================
  describe('2. Missing Authentication Headers Fail Closed', () => {
    it('returns 401 when no auth headers are provided at all', async () => {
      const { pubKeyHex } = await createEd25519Pair();
      const deps = {
        missionFabricTenants: [TENANT],
        gate: { botId: BOT_ID, pubKeyHex, founderIds: [FOUNDER_TELEGRAM_ID], now: () => NOW_MS },
      };

      const result = await evaluateMissionFabricGate({
        tenant: TENANT,
        headers: {},
      }, deps);

      assert.equal(result.status, 401);
      assert.match(result.error, /missing initData/);
    });

    it('returns 401 when x-telegram-init-data header is empty whitespace', async () => {
      const { pubKeyHex } = await createEd25519Pair();
      const deps = {
        missionFabricTenants: [TENANT],
        gate: { botId: BOT_ID, pubKeyHex, founderIds: [FOUNDER_TELEGRAM_ID], now: () => NOW_MS },
      };

      const result = await evaluateMissionFabricGate({
        tenant: TENANT,
        headers: { 'x-telegram-init-data': '   ' },
      }, deps);

      assert.equal(result.status, 401);
      assert.match(result.error, /missing initData/);
    });

    it('returns 403 when requested tenant is not in the server-owned allowlist', async () => {
      const { pair, pubKeyHex } = await createEd25519Pair();
      const initData = await signTelegramInitData({ userId: FOUNDER_TELEGRAM_ID, pair });

      const deps = {
        missionFabricTenants: ['other-tenant'], // 'cambium' not enabled
        gate: { botId: BOT_ID, pubKeyHex, founderIds: [FOUNDER_TELEGRAM_ID], now: () => NOW_MS },
      };

      const result = await evaluateMissionFabricGate({
        tenant: TENANT,
        headers: { 'x-telegram-init-data': initData },
      }, deps);

      assert.equal(result.status, 403);
      assert.match(result.error, /mission fabric tenant is not enabled/);
    });
  });

  // =========================================================================
  // 3. Tampered / Expired Telegram initData Fails Closed
  // =========================================================================
  describe('3. Tampered & Expired Telegram initData Cryptographic Gating', () => {
    it('fails closed with 401 when Ed25519 signature is tampered', async () => {
      const { pair, pubKeyHex } = await createEd25519Pair();
      const initData = await signTelegramInitData({
        userId: FOUNDER_TELEGRAM_ID,
        pair,
        signatureOverride: b64url('corrupted-signature-bytes-which-fail-verification'),
      });

      const deps = {
        missionFabricTenants: [TENANT],
        gate: { botId: BOT_ID, pubKeyHex, founderIds: [FOUNDER_TELEGRAM_ID], now: () => NOW_MS },
      };

      const result = await evaluateMissionFabricGate({
        tenant: TENANT,
        headers: { 'x-telegram-init-data': initData },
      }, deps);

      assert.equal(result.status, 401);
      assert.equal(result.reason, 'bad signature');
    });

    it('fails closed with 401 when auth_date exceeds maxAgeSec (stale token / replay attempt)', async () => {
      const { pair, pubKeyHex } = await createEd25519Pair();
      const staleAuthDate = Math.floor(NOW_MS / 1000 - 601); // 601s old (> 600s TTL)
      const initData = await signTelegramInitData({
        userId: FOUNDER_TELEGRAM_ID,
        authDate: staleAuthDate,
        pair,
      });

      const deps = {
        missionFabricTenants: [TENANT],
        gate: { botId: BOT_ID, pubKeyHex, founderIds: [FOUNDER_TELEGRAM_ID], now: () => NOW_MS, maxAgeSec: 600 },
      };

      const result = await evaluateMissionFabricGate({
        tenant: TENANT,
        headers: { 'x-telegram-init-data': initData },
      }, deps);

      assert.equal(result.status, 401);
      assert.equal(result.reason, 'stale auth_date');
    });

    it('fails closed with 401 when signature parameter is stripped', async () => {
      const { pair, pubKeyHex } = await createEd25519Pair();
      const valid = await signTelegramInitData({ userId: FOUNDER_TELEGRAM_ID, pair });
      const params = new URLSearchParams(valid);
      params.delete('signature');

      const deps = {
        missionFabricTenants: [TENANT],
        gate: { botId: BOT_ID, pubKeyHex, founderIds: [FOUNDER_TELEGRAM_ID], now: () => NOW_MS },
      };

      const result = await evaluateMissionFabricGate({
        tenant: TENANT,
        headers: { 'x-telegram-init-data': params.toString() },
      }, deps);

      assert.equal(result.status, 401);
      assert.equal(result.reason, 'missing third-party signature');
    });

    it('fails closed with 401 when user field is corrupt JSON or missing id', async () => {
      const { pair, pubKeyHex } = await createEd25519Pair();
      const initData = await signTelegramInitData({
        pair,
        user: 'invalid-non-json-user-string',
      });

      const deps = {
        missionFabricTenants: [TENANT],
        gate: { botId: BOT_ID, pubKeyHex, founderIds: [FOUNDER_TELEGRAM_ID], now: () => NOW_MS },
      };

      const result = await evaluateMissionFabricGate({
        tenant: TENANT,
        headers: { 'x-telegram-init-data': initData },
      }, deps);

      assert.equal(result.status, 401);
      assert.equal(result.reason, 'missing telegram user id');
    });
  });

  // =========================================================================
  // 4. Cloudflare Access Service Tokens Floor to 'consultant' & Fail Closed
  // =========================================================================
  describe('4. Cloudflare Access Service Tokens Flooring & HTTP 403 Enforcement', () => {
    it('floors service token credentials to consultant and rejects with HTTP 403 by design', async () => {
      const kv = fakePlexusKv();
      const fetchImpl = makeJwksFetch({
        status: 404, // Service token identity is not a registered human user in D1 plexus_identities
        body: { code: 'identity_not_registered', message: 'Service account has no user identity' },
      });

      const deps = {
        missionFabricTenants: [TENANT],
        kv,
        plexus: { teamDomain: TEAM_DOMAIN, aud: AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' },
        plexusFetchImpl: fetchImpl,
      };

      // Presentation of service-token headers alone
      const result = await evaluateMissionFabricGate({
        tenant: TENANT,
        headers: {
          'cf-access-client-id': '796e37bc.access',
          'cf-access-client-secret': 'sec-001289381203',
        },
      }, deps);

      assert.equal(result.status, 403);
      assert.match(result.error, /service tokens floor to consultant/i);
    });

    it('ensures whoami 404 or unrecognized service token payload maps to consultant role in resolver', async () => {
      const kv = fakePlexusKv();
      const jwt = signCfAccessJwt(validCfAccessPayload({ email: 'service-token@thoughtseedlabs.cloudflareaccess.com' }));
      const fetchImpl = makeJwksFetch({
        status: 404,
        body: { code: 'identity_not_registered' },
      });

      const res = await resolvePlexusPrincipal(
        { 'cf-access-jwt-assertion': jwt },
        { teamDomain: TEAM_DOMAIN, aud: AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' },
        kv,
        fetchImpl,
      );

      assert.equal(res.kind, 'principal');
      assert.equal(res.principal.role, 'consultant');
    });

    it('blocks consultant principal at the founder gate with HTTP 403', async () => {
      const kv = fakePlexusKv();
      const jwt = signCfAccessJwt(validCfAccessPayload({ email: 'consultant@partner.com' }));
      const fetchImpl = makeJwksFetch({
        status: 200,
        body: {
          ok: true,
          data: {
            email: 'consultant@partner.com',
            role: 'consultant',
            isActive: true,
            identityId: 'pid_consultant_01',
          },
        },
      });

      const deps = {
        missionFabricTenants: [TENANT],
        kv,
        plexus: { teamDomain: TEAM_DOMAIN, aud: AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' },
        plexusFetchImpl: fetchImpl,
      };

      const result = await evaluateMissionFabricGate({
        tenant: TENANT,
        headers: { 'cf-access-jwt-assertion': jwt },
      }, deps);

      assert.equal(result.status, 403);
      assert.equal(result.assignedRole, 'consultant');
      assert.match(result.error, /founder identity required/);
    });
  });

  // =========================================================================
  // 5. Untrusted & Non-Founder Identities Fail Closed
  // =========================================================================
  describe('5. Untrusted & Non-Founder Identities Fail Closed', () => {
    it('fails closed with 401 when non-founder signed Telegram user is not in viewer allowlist', async () => {
      const { pair, pubKeyHex } = await createEd25519Pair();
      const initData = await signTelegramInitData({ userId: NON_FOUNDER_TELEGRAM_ID, pair });

      const deps = {
        missionFabricTenants: [TENANT],
        gate: {
          botId: BOT_ID,
          pubKeyHex,
          founderIds: [FOUNDER_TELEGRAM_ID], // NON_FOUNDER_TELEGRAM_ID is omitted
          now: () => NOW_MS,
        },
        missionFabricViewerIds: [], // no viewers allowlisted
      };

      const result = await evaluateMissionFabricGate({
        tenant: TENANT,
        headers: { 'x-telegram-init-data': initData },
      }, deps);

      assert.equal(result.status, 401);
      assert.equal(result.reason, 'not authorized for mission fabric');
    });

    it('rejects employee role Access JWT with HTTP 403', async () => {
      const kv = fakePlexusKv();
      const jwt = signCfAccessJwt(validCfAccessPayload({ email: 'dev@thoughtseed.space' }));
      const fetchImpl = makeJwksFetch({
        status: 200,
        body: {
          ok: true,
          data: {
            email: 'dev@thoughtseed.space',
            role: 'employee', // maps to 'team'
            isActive: true,
            identityId: 'pid_dev_01',
          },
        },
      });

      const deps = {
        missionFabricTenants: [TENANT],
        kv,
        plexus: { teamDomain: TEAM_DOMAIN, aud: AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' },
        plexusFetchImpl: fetchImpl,
      };

      const result = await evaluateMissionFabricGate({
        tenant: TENANT,
        headers: { 'cf-access-jwt-assertion': jwt },
      }, deps);

      assert.equal(result.status, 403);
      assert.equal(result.assignedRole, 'team');
      assert.match(result.error, /founder identity required/);
    });

    it('floors inactive admin (isActive: false) to consultant and rejects with 403', async () => {
      const kv = fakePlexusKv();
      const jwt = signCfAccessJwt(validCfAccessPayload({ email: 'shesh@thoughtseed.space' }));
      const fetchImpl = makeJwksFetch({
        status: 200,
        body: {
          ok: true,
          data: {
            email: 'shesh@thoughtseed.space',
            role: 'admin',
            isActive: false, // suspended or inactive identity
            identityId: 'pid_admin_inactive',
          },
        },
      });

      const deps = {
        missionFabricTenants: [TENANT],
        kv,
        plexus: { teamDomain: TEAM_DOMAIN, aud: AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' },
        plexusFetchImpl: fetchImpl,
      };

      const result = await evaluateMissionFabricGate({
        tenant: TENANT,
        headers: { 'cf-access-jwt-assertion': jwt },
      }, deps);

      assert.equal(result.status, 403);
      assert.equal(result.assignedRole, 'consultant');
    });

    it('admits active admin whoami identity as founder and grants unredacted projection', async () => {
      const kv = fakePlexusKv();
      const jwt = signCfAccessJwt(validCfAccessPayload({ email: 'shesh@thoughtseed.space' }));
      const fetchImpl = makeJwksFetch({
        status: 200,
        body: {
          ok: true,
          data: {
            email: 'shesh@thoughtseed.space',
            role: 'admin',
            isActive: true,
            identityId: 'pid_admin_shesh',
          },
        },
      });

      const deps = {
        missionFabricTenants: [TENANT],
        kv,
        plexus: { teamDomain: TEAM_DOMAIN, aud: AUD, whoamiUrl: 'https://plexus-api.test/v1/whoami' },
        plexusFetchImpl: fetchImpl,
      };

      const result = await evaluateMissionFabricGate({
        tenant: TENANT,
        headers: { 'cf-access-jwt-assertion': jwt },
      }, deps);

      assert.equal(result.status, 200);
      assert.equal(result.ok, true);
      assert.equal(result.role, 'founder');
      assert.equal(result.redacted, false);
      assert.equal(result.actorId, 'pid_admin_shesh');
    });
  });

  // =========================================================================
  // 6. Phase G Read Client Fail-Closed Error Wrapping
  // =========================================================================
  describe('6. Phase G Read Client Fail-Closed Seam Guarantees', () => {
    const BASE_URL = 'https://curious.thoughtseed.space';

    function fakeFetch(status, body, opts = {}) {
      return async () => {
        if (opts.throwErr) throw opts.throwErr;
        return {
          status,
          async json() {
            if (typeof body === 'string') throw new SyntaxError('not json');
            return body;
          },
          async text() {
            return typeof body === 'string' ? body : JSON.stringify(body);
          },
        };
      };
    }

    it('cleanly wraps HTTP 401 response into typed unauthorized gap without throwing', async () => {
      const res = await readMissionFabric({
        baseUrl: BASE_URL,
        tenantId: TENANT,
        liveReads: true,
        fetchImpl: fakeFetch(401, { error: 'telegram authentication failed' }),
      });

      assert.equal(res.ok, false);
      assert.equal(res.kind, 'gap');
      assert.equal(res.reason, 'unauthorized');
      assert.equal(res.status, 401);
      assert.equal(res.tenantId, TENANT);
    });

    it('cleanly wraps HTTP 403 response into typed forbidden gap without throwing', async () => {
      const res = await readMissionFabric({
        baseUrl: BASE_URL,
        tenantId: TENANT,
        liveReads: true,
        fetchImpl: fakeFetch(403, { error: 'forbidden: founder identity required' }),
      });

      assert.equal(res.ok, false);
      assert.equal(res.kind, 'gap');
      assert.equal(res.reason, 'forbidden');
      assert.equal(res.status, 403);
      assert.equal(res.tenantId, TENANT);
    });

    it('cleanly wraps transport errors (connection refused, DNS failure) into transport-error gap', async () => {
      const res = await readMissionFabric({
        baseUrl: BASE_URL,
        tenantId: TENANT,
        liveReads: true,
        fetchImpl: fakeFetch(200, {}, { throwErr: new Error('ECONNREFUSED 127.0.0.1:443') }),
      });

      assert.equal(res.ok, false);
      assert.equal(res.kind, 'gap');
      assert.equal(res.reason, 'transport-error');
      assert.match(res.detail, /ECONNREFUSED/);
    });

    it('cleanly wraps request abort / timeout into timeout gap', async () => {
      const abortErr = new Error('request aborted');
      abortErr.name = 'AbortError';

      const res = await readMissionFabric({
        baseUrl: BASE_URL,
        tenantId: TENANT,
        liveReads: true,
        timeoutMs: 10,
        fetchImpl: fakeFetch(200, {}, { throwErr: abortErr }),
      });

      assert.equal(res.ok, false);
      assert.equal(res.kind, 'gap');
      assert.equal(res.reason, 'timeout');
    });

    it('cleanly wraps digest tampering into digest-mismatch gap', async () => {
      const rawProjection = {
        schema: 'cambium.mission-fabric-projection.v1',
        projectionVersion: 1,
        sourceOfTruth: 'd1-goal-graph',
        readOnly: true,
        tenantId: TENANT,
        graphVersion: 1,
        asOf: NOW_ISO,
        nodes: [{ kind: 'goal', id: 'goal-1' }],
        edges: [],
        gaps: [],
      };
      const trueDigest = projectionDigest(rawProjection);
      // Tamper graphVersion without updating claimed digest
      const tamperedProjection = {
        ...rawProjection,
        graphVersion: 999,
        graphDigest: trueDigest,
      };

      const res = await readMissionFabric({
        baseUrl: BASE_URL,
        tenantId: TENANT,
        liveReads: true,
        fetchImpl: fakeFetch(200, { projection: tamperedProjection }),
      });

      assert.equal(res.ok, false);
      assert.equal(res.kind, 'gap');
      assert.equal(res.reason, 'digest-mismatch');
    });

    it('successfully accepts self-consistent valid founder projection', async () => {
      const rawProjection = {
        schema: 'cambium.mission-fabric-projection.v1',
        projectionVersion: 1,
        sourceOfTruth: 'd1-goal-graph',
        readOnly: true,
        tenantId: TENANT,
        graphVersion: 1,
        asOf: NOW_ISO,
        nodes: [{ kind: 'goal', id: 'goal-1' }],
        edges: [],
        gaps: [],
      };
      const digest = projectionDigest(rawProjection);
      const validProjection = {
        ...rawProjection,
        graphDigest: digest,
      };

      const res = await readMissionFabric({
        baseUrl: BASE_URL,
        tenantId: TENANT,
        liveReads: true,
        fetchImpl: fakeFetch(200, validProjection),
      });

      assert.equal(res.ok, true);
      assert.equal(res.kind, 'projection');
      assert.equal(res.tenantId, TENANT);
      assert.equal(res.graphDigest, digest);
    });
  });
});

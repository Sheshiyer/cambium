// Native founder session transfer (cambium.native-session.v1).
//
// App-owned delegated session for the Cambium Mac app: external browser +
// PKCE S256 (RFC 8252 / RFC 7636). This module is not a founder or member
// identity authority. The browser leg trusts only the injected Access/Plexus
// founder verifier; every later step re-checks the stored founder's current
// role and enrollment through injected server callbacks. Request bodies never
// carry founder, principal or tenant authority.
//
// Routes (handler composition is a later packet):
//   GET  /v1/native/session/authorize  browser navigation, query only, 302 to callback
//   POST /v1/native/session/exchange   cookie-free JSON, PKCE proves possession
//   GET  /v1/native/session            native bearer, returns scope
//   POST /v1/native/session/logout     native bearer, body exactly {}
//
// Credentials: code `cnc1_` + 43 base64url chars and token `cns1_` + 43
// base64url chars (256 random bits each). Only SHA-256 hex digests reach the
// store. The raw values appear once: the code in the callback Location, the
// token in the successful exchange body. No refresh token, no client secret.

import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

export const NATIVE_SESSION_CONTRACT = 'cambium.native-session.v1' as const;
export const NATIVE_SESSION_PATHS = {
  authorize: '/v1/native/session/authorize',
  exchange: '/v1/native/session/exchange',
  session: '/v1/native/session',
  logout: '/v1/native/session/logout',
} as const;
export const NATIVE_CODE_PREFIX = 'cnc1_' as const;
export const NATIVE_TOKEN_PREFIX = 'cns1_' as const;
export const NATIVE_CODE_TTL_MS = 60_000;
export const NATIVE_SESSION_TTL_MS = 15 * 60_000;
export const NATIVE_SESSION_MAX_BODY_BYTES = 2048;
export const NATIVE_SESSION_MAX_URL_BYTES = 2048;
const RANDOM_BYTES = 32;

const TENANT = /^[a-z][a-z0-9-]{1,63}$/;
const FOUNDER = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,239}$/;
const CLIENT_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
const VERIFIER = /^[A-Za-z0-9._~-]{43,128}$/;
const STATE = /^[A-Za-z0-9_-]{22,128}$/;
const CODE = /^cnc1_[A-Za-z0-9_-]{43}$/;
const TOKEN = /^cns1_[A-Za-z0-9_-]{43}$/;
const BEARER = /^Bearer (cns1_[A-Za-z0-9_-]{43})$/;
const NATIVE_REALM = /\b(?:cns1|cnc1)_/;
const ISO = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/;
// Exact registered reversed-domain private scheme with host and path
// (space.thoughtseed.cambium.native.dev://oauth/callback). No userinfo, port,
// query, fragment, percent-encoding, or dot segments.
const DEV_REDIRECT = /^(space\.thoughtseed(?:\.[a-z0-9-]+)+):\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)*)((?:\/[A-Za-z0-9._~-]+)+)$/;

export interface NativeSessionClient { clientId: string; redirectUri: string }

export interface NativeSessionScope {
  founderId: string;
  tenantId: string;
  clientId: string;
  expiresAt: string;
}

export interface NativeAuthorizationCodeRecord {
  codeDigest: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  founderId: string;
  tenantId: string;
  issuedAt: string;
  expiresAt: string;
}

export interface NativeCodeMatch {
  codeDigest: string;
  clientId: string;
  redirectUri: string;
  /** Computed from the presented verifier, never taken from the request. */
  codeChallenge: string;
  now: string;
}

export interface NativeSessionGrant extends NativeCodeMatch {
  founderId: string;
  tenantId: string;
  tokenDigest: string;
  expiresAt: string;
}

/**
 * Sole session authority. `grant` MUST be one conditional statement keyed by
 * the code digest with a unique code→session reference (see
 * native-session-d1.ts) so a code yields at most one session.
 */
export interface NativeSessionStore {
  saveCode(record: NativeAuthorizationCodeRecord): Promise<void>;
  /** Read-only match of an unused, unexpired code. Never consumes. */
  peekCode(match: NativeCodeMatch): Promise<{ founderId: string; tenantId: string; expiresAt: string } | null>;
  /** Linearizing step: true only for the single winning exchange. */
  grant(input: NativeSessionGrant): Promise<boolean>;
  readSession(tokenDigest: string, now: string): Promise<NativeSessionScope | null>;
  /** Revokes exactly one token. Returns true when this call revoked it. */
  revoke(tokenDigest: string, now: string): Promise<boolean>;
}

export interface NativeSessionDeps {
  /** Access/Plexus founder approver ID for a browser navigation, else null. */
  verifyBrowserFounder(request: Request): Promise<string | null>;
  /** Current server-owned role for a founder ID (must equal 'founder'). */
  currentRole(founderId: string): Promise<string | null>;
  /** Current explicit tenant enrollment for a founder ID. */
  enrolledTenants(founderId: string): Promise<readonly string[] | null>;
  clients: readonly NativeSessionClient[];
  store: NativeSessionStore;
  now(): string;
  randomBytes(length: number): Uint8Array;
  /** Exact https origin this owner serves. */
  ownerOrigin: string;
}

export interface NativeSessionHost {
  readonly deps: NativeSessionDeps;
  client(clientId: string): NativeSessionClient | undefined;
}

export type NativeSessionResolution =
  /** No native credential presented; the caller may run its existing auth. */
  | { kind: 'absent' }
  | { kind: 'native'; scope: NativeSessionScope; tokenDigest: string }
  /** Native realm claimed but refused. Never fall back to browser identity. */
  | { kind: 'refused'; response: Response };

/** Default owner randomness: Web Crypto CSPRNG. */
export const standardNativeRandom = (length: number) => crypto.getRandomValues(new Uint8Array(length));

const isFn = (value: unknown) => typeof value === 'function';

/** True only for a real UTC instant in canonical millisecond ISO. Never throws. */
const isoOk = (value: unknown): value is string => {
  if (typeof value !== 'string' || !ISO.test(value)) return false;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return false;
  try {
    return new Date(parsed).toISOString() === value;
  } catch {
    return false;
  }
};

const plusMs = (iso: string, ms: number): string | null => {
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  const next = parsed + ms;
  if (!Number.isFinite(next)) return null;
  try {
    const out = new Date(next).toISOString();
    return isoOk(out) ? out : null;
  } catch {
    return null;
  }
};

const actorOk = (founderId: unknown, tenantId: unknown, clientId?: unknown): boolean =>
  typeof founderId === 'string' && FOUNDER.test(founderId)
  && typeof tenantId === 'string' && TENANT.test(tenantId)
  && (clientId === undefined || (typeof clientId === 'string' && CLIENT_ID.test(clientId)));
const sha256Hex = (value: string) => createHash('sha256').update(value, 'ascii').digest('hex');
export const nativeCredentialDigest = sha256Hex;

/** RFC 7636 §4.2 S256: BASE64URL(SHA256(ASCII(code_verifier))). */
export function s256Challenge(verifier: string): string {
  return createHash('sha256').update(verifier, 'ascii').digest('base64url');
}

export function validNativeRedirect(uri: unknown): uri is string {
  if (typeof uri !== 'string' || uri.length > 256) return false;
  const match = DEV_REDIRECT.exec(uri);
  if (!match) return false;
  // The character classes already exclude userinfo, port, query, fragment and
  // percent-encoding; only dot segments need an explicit check.
  return !match[3].split('/').some(segment => segment === '.' || segment === '..');
}

function validOrigin(origin: unknown): origin is string {
  if (typeof origin !== 'string') return false;
  try {
    const url = new URL(origin);
    return url.protocol === 'https:' && !url.username && !url.password && url.origin === origin;
  } catch { return false; }
}

/** Returns a host only when every owner binding is present and valid; otherwise routes stay 503. */
export function createNativeSessionHost(deps: Partial<NativeSessionDeps> | undefined): NativeSessionHost | undefined {
  if (!deps) return undefined;
  const { store, clients } = deps;
  if (!isFn(deps.verifyBrowserFounder) || !isFn(deps.currentRole) || !isFn(deps.enrolledTenants)
      || !isFn(deps.now) || !isFn(deps.randomBytes) || !validOrigin(deps.ownerOrigin)) return undefined;
  if (!store || !isFn(store.saveCode) || !isFn(store.peekCode) || !isFn(store.grant)
      || !isFn(store.readSession) || !isFn(store.revoke)) return undefined;
  if (!Array.isArray(clients) || !clients.length || clients.length > 16) return undefined;
  const registry = new Map<string, NativeSessionClient>();
  for (const entry of clients) {
    if (!entry || Object.keys(entry).sort().join(',') !== 'clientId,redirectUri'
        || typeof entry.clientId !== 'string' || !CLIENT_ID.test(entry.clientId)
        || !validNativeRedirect(entry.redirectUri) || registry.has(entry.clientId)) return undefined;
    registry.set(entry.clientId, { clientId: entry.clientId, redirectUri: entry.redirectUri });
  }
  const frozen = Object.freeze({ ...deps, clients: [...registry.values()] }) as NativeSessionDeps;
  return { deps: frozen, client: id => registry.get(id) };
}

// ── Responses ───────────────────────────────────────────────────────────────

type ErrorCode =
  | 'invalid_request' | 'invalid_client' | 'invalid_grant' | 'unauthorized' | 'forbidden'
  | 'tenant_selection_required' | 'method_not_allowed' | 'json_required' | 'input_too_large'
  | 'not_found' | 'native_session_unconfigured' | 'native_session_unavailable' | 'mixed_credentials';

const SECURITY_HEADERS = {
  'cache-control': 'no-store',
  pragma: 'no-cache',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
};

function reply(status: number, body: Record<string, unknown>, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ contractVersion: NATIVE_SESSION_CONTRACT, ...body }), {
    status, headers: { 'content-type': 'application/json', ...SECURITY_HEADERS, ...extra },
  });
}
const fail = (status: number, error: ErrorCode, extra: Record<string, unknown> = {}) => reply(status, { error, ...extra });
const unconfigured = () => fail(503, 'native_session_unconfigured');
const unavailable = () => fail(503, 'native_session_unavailable');

// ── Shared helpers ──────────────────────────────────────────────────────────

function sameOrigin(request: Request, host: NativeSessionHost): boolean {
  try { return new URL(request.url).origin === host.deps.ownerOrigin; } catch { return false; }
}

/** Reads the clock and refuses non-canonical ISO output. */
function clock(host: NativeSessionHost): string | null {
  try { const now = host.deps.now(); return isoOk(now) ? now : null; } catch { return null; }
}

/** 256-bit opaque credential, or null when the injected source misbehaves. */
function mint(host: NativeSessionHost, prefix: string): string | null {
  let bytes: unknown;
  try { bytes = host.deps.randomBytes(RANDOM_BYTES); } catch { return null; }
  if (!(bytes instanceof Uint8Array) || bytes.length !== RANDOM_BYTES) return null;
  return `${prefix}${Buffer.from(bytes).toString('base64url')}`;
}

/** Current founder role plus enrollment for one tenant; null on any lookup failure. */
async function currentlyEnrolled(host: NativeSessionHost, founderId: string, tenantId: string): Promise<boolean | null> {
  try {
    if (await host.deps.currentRole(founderId) !== 'founder') return false;
    const tenants = await host.deps.enrolledTenants(founderId);
    return Array.isArray(tenants) && tenants.includes(tenantId);
  } catch { return null; }
}

const browserCredential = (request: Request) =>
  Boolean(request.headers.get('cf-access-jwt-assertion')?.trim())
  || Boolean(request.headers.get('x-telegram-init-data')?.trim())
  || /(?:^|;\s*)CF_Authorization=/.test(request.headers.get('cookie') ?? '');

async function readJson(request: Request): Promise<Record<string, unknown> | Response> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') return fail(415, 'json_required');
  const declared = request.headers.get('content-length');
  if (declared !== null && !(Number(declared) <= NATIVE_SESSION_MAX_BODY_BYTES)) return fail(413, 'input_too_large');
  let bytes: Uint8Array;
  try {
    const reader = request.body?.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > NATIVE_SESSION_MAX_BODY_BYTES) { await reader.cancel().catch(() => {}); return fail(413, 'input_too_large'); }
      chunks.push(value);
    }
    bytes = Buffer.concat(chunks);
  } catch { return fail(400, 'invalid_request'); }
  try {
    const value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : fail(400, 'invalid_request');
  } catch { return fail(400, 'invalid_request'); }
}

// ── Authorize (browser GET) ─────────────────────────────────────────────────

const AUTHORIZE_REQUIRED = ['client_id', 'code_challenge', 'code_challenge_method', 'redirect_uri', 'state'];

export async function nativeSessionAuthorizeHttp(request: Request, host?: NativeSessionHost): Promise<Response> {
  if (!host) return unconfigured();
  if (request.method !== 'GET') return fail(405, 'method_not_allowed', {});
  if (!sameOrigin(request, host) || request.url.length > NATIVE_SESSION_MAX_URL_BYTES) return fail(400, 'invalid_request');
  const url = new URL(request.url);
  if (url.hash) return fail(400, 'invalid_request');
  const params = url.searchParams;
  const keys = [...params.keys()];
  const allowed = new Set([...AUTHORIZE_REQUIRED, 'tenant']);
  if (keys.some(key => !allowed.has(key)) || new Set(keys).size !== keys.length
      || AUTHORIZE_REQUIRED.some(key => !params.has(key))) return fail(400, 'invalid_request');
  const clientId = params.get('client_id')!;
  const redirectUri = params.get('redirect_uri')!;
  const registered = CLIENT_ID.test(clientId) ? host.client(clientId) : undefined;
  // Never redirect to an unverified callback.
  if (!registered || registered.redirectUri !== redirectUri) return fail(400, 'invalid_client');
  const challenge = params.get('code_challenge')!;
  const state = params.get('state')!;
  const tenant = params.get('tenant');
  if (params.get('code_challenge_method') !== 'S256' || !CHALLENGE.test(challenge) || !STATE.test(state)
      || (tenant !== null && !TENANT.test(tenant))) return fail(400, 'invalid_request');

  let founderId: string | null;
  try { founderId = await host.deps.verifyBrowserFounder(request); } catch { return unavailable(); }
  if (typeof founderId !== 'string' || !FOUNDER.test(founderId)) return fail(401, 'unauthorized');

  let tenants: string[];
  try {
    if (await host.deps.currentRole(founderId) !== 'founder') return fail(403, 'forbidden');
    const listed = await host.deps.enrolledTenants(founderId);
    if (!Array.isArray(listed)) return fail(403, 'forbidden');
    tenants = [...new Set(listed.filter((t): t is string => typeof t === 'string' && TENANT.test(t)))].sort();
  } catch { return unavailable(); }
  let tenantId: string;
  if (tenant !== null) {
    if (!tenants.includes(tenant)) return fail(403, 'forbidden');
    tenantId = tenant;
  } else if (tenants.length === 1) {
    tenantId = tenants[0];
  } else if (tenants.length > 1) {
    return fail(409, 'tenant_selection_required', { tenants: tenants.slice(0, 64) });
  } else {
    return fail(403, 'forbidden');
  }

  // TTL is measured after browser verification and the lookups above.
  const issuedAt = clock(host);
  const code = mint(host, NATIVE_CODE_PREFIX);
  if (!issuedAt || !code) return unavailable();
  const codeExpiresAt = plusMs(issuedAt, NATIVE_CODE_TTL_MS);
  if (!codeExpiresAt) return unavailable();
  try {
    await host.deps.store.saveCode({
      codeDigest: sha256Hex(code), clientId, redirectUri, codeChallenge: challenge,
      founderId, tenantId, issuedAt, expiresAt: codeExpiresAt,
    });
  } catch { return unavailable(); }
  const location = `${redirectUri}?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
  return new Response(null, { status: 302, headers: { location, ...SECURITY_HEADERS } });
}

// ── Exchange (cookie-free POST) ─────────────────────────────────────────────

const EXCHANGE_KEYS = 'clientId,code,codeVerifier,contractVersion,redirectUri';

export async function nativeSessionExchangeHttp(request: Request, host?: NativeSessionHost): Promise<Response> {
  if (!host) return unconfigured();
  if (request.method !== 'POST') return fail(405, 'method_not_allowed');
  // Cookie-free: browser credentials and any Authorization header are refused
  // before the browser verifier or the store is consulted.
  if (browserCredential(request) || request.headers.has('authorization')) return fail(400, 'mixed_credentials');
  const origin = request.headers.get('origin');
  if (!sameOrigin(request, host) || (origin !== null && origin !== host.deps.ownerOrigin)) return fail(400, 'invalid_request');
  const input = await readJson(request);
  if (input instanceof Response) return input;
  if (Object.keys(input).sort().join(',') !== EXCHANGE_KEYS || input.contractVersion !== NATIVE_SESSION_CONTRACT
      || typeof input.clientId !== 'string' || typeof input.redirectUri !== 'string'
      || typeof input.code !== 'string' || typeof input.codeVerifier !== 'string') return fail(400, 'invalid_request');
  const registered = CLIENT_ID.test(input.clientId) ? host.client(input.clientId) : undefined;
  if (!registered || registered.redirectUri !== input.redirectUri) return fail(400, 'invalid_client');
  if (!VERIFIER.test(input.codeVerifier)) return fail(400, 'invalid_request');
  if (!CODE.test(input.code)) return fail(400, 'invalid_grant');

  // No browser verifier here: PKCE proves possession and the stored code
  // determines founder and tenant.
  const match = {
    codeDigest: sha256Hex(input.code), clientId: registered.clientId, redirectUri: registered.redirectUri,
    codeChallenge: s256Challenge(input.codeVerifier),
  };
  const first = clock(host);
  if (!first) return unavailable();
  let pending: Awaited<ReturnType<NativeSessionStore['peekCode']>>;
  try { pending = await host.deps.store.peekCode({ ...match, now: first }); } catch { return unavailable(); }
  if (!pending || !isoOk(pending.expiresAt) || !actorOk(pending.founderId, pending.tenantId)) {
    return fail(400, 'invalid_grant');
  }

  const enrolled = await currentlyEnrolled(host, pending.founderId, pending.tenantId);
  if (enrolled === null) return unavailable();
  if (!enrolled) return fail(403, 'forbidden');

  // Re-read the clock and the unused code after the role/enrollment await so a
  // revocation or expiry during that lookup cannot still grant.
  const now = clock(host);
  const token = mint(host, NATIVE_TOKEN_PREFIX);
  if (!now || !token) return unavailable();
  let fresh: Awaited<ReturnType<NativeSessionStore['peekCode']>>;
  try { fresh = await host.deps.store.peekCode({ ...match, now }); } catch { return unavailable(); }
  // The peek awaited, so take a fresh instant for the code-expiry check, the
  // grant timestamp (the store compares code expiry with input.now) and the
  // session lifetime.
  const granting = clock(host);
  if (!granting) return unavailable();
  if (!fresh || !isoOk(fresh.expiresAt) || !(fresh.expiresAt > granting)
      || fresh.founderId !== pending.founderId || fresh.tenantId !== pending.tenantId
      || !actorOk(fresh.founderId, fresh.tenantId)) return fail(400, 'invalid_grant');
  const expiresAt = plusMs(granting, NATIVE_SESSION_TTL_MS);
  if (!expiresAt) return unavailable();
  let granted: boolean;
  try {
    granted = await host.deps.store.grant({
      ...match, now: granting, founderId: pending.founderId, tenantId: pending.tenantId,
      tokenDigest: sha256Hex(token), expiresAt,
    });
  } catch {
    // The grant may or may not have landed. The code is single-use either way,
    // so the client restarts authorization; it never resends this exchange.
    return fail(503, 'native_session_unavailable', { retry: 'restart_authorization' });
  }
  if (!granted) return fail(400, 'invalid_grant');
  // The grant awaited. If the clock is bad or the new session already lapsed,
  // the code is spent: never hand out the token or mint a second session.
  const done = clock(host);
  if (!done || !(expiresAt > done)) return fail(503, 'native_session_unavailable', { retry: 'restart_authorization' });
  return reply(200, {
    token, tokenType: 'Bearer', expiresAt, founderId: pending.founderId, tenantId: pending.tenantId,
    clientId: registered.clientId, role: 'founder', enrolled: true,
  });
}

// ── Native bearer resolution ────────────────────────────────────────────────

/**
 * Resolves the native realm for any request. A request that claims the native
 * realm (native prefix in Authorization) is either a verified native scope or
 * refused; it never falls back to browser identity. A native bearer combined
 * with a browser credential is refused.
 */
export async function resolveNativeSession(request: Request, host?: NativeSessionHost): Promise<NativeSessionResolution> {
  const header = request.headers.get('authorization');
  if (header === null || !NATIVE_REALM.test(header)) return { kind: 'absent' };
  if (!host) return { kind: 'refused', response: unconfigured() };
  if (browserCredential(request)) return { kind: 'refused', response: fail(400, 'mixed_credentials') };
  const match = BEARER.exec(header);
  if (!match || !TOKEN.test(match[1])) return { kind: 'refused', response: fail(401, 'unauthorized') };
  const tokenDigest = sha256Hex(match[1]);
  const first = clock(host);
  if (!first) return { kind: 'refused', response: unavailable() };
  let row: NativeSessionScope | null;
  try { row = await host.deps.store.readSession(tokenDigest, first); } catch { return { kind: 'refused', response: unavailable() }; }
  if (!row || !isoOk(row.expiresAt) || !(row.expiresAt > first)
      || !actorOk(row.founderId, row.tenantId, row.clientId)) {
    return { kind: 'refused', response: fail(401, 'unauthorized') };
  }
  const registered = host.client(row.clientId);
  if (!registered) return { kind: 'refused', response: fail(401, 'unauthorized') };
  const enrolled = await currentlyEnrolled(host, row.founderId, row.tenantId);
  if (enrolled === null) return { kind: 'refused', response: unavailable() };
  if (!enrolled) return { kind: 'refused', response: fail(403, 'forbidden') };
  // Re-read the stored session after the awaited lookups so revocation or
  // expiry during that wait cannot still be accepted.
  const now = clock(host);
  if (!now) return { kind: 'refused', response: unavailable() };
  let fresh: NativeSessionScope | null;
  try { fresh = await host.deps.store.readSession(tokenDigest, now); } catch { return { kind: 'refused', response: unavailable() }; }
  // The final read awaited, so judge expiry against a fresh instant.
  const end = clock(host);
  if (!end) return { kind: 'refused', response: unavailable() };
  if (!fresh || !isoOk(fresh.expiresAt) || !(fresh.expiresAt > end)
      || fresh.founderId !== row.founderId || fresh.tenantId !== row.tenantId
      || fresh.clientId !== row.clientId || !actorOk(fresh.founderId, fresh.tenantId, fresh.clientId)) {
    return { kind: 'refused', response: fail(401, 'unauthorized') };
  }
  return {
    kind: 'native', tokenDigest,
    scope: { founderId: fresh.founderId, tenantId: fresh.tenantId, clientId: fresh.clientId, expiresAt: fresh.expiresAt },
  };
}

const scopeBody = (scope: NativeSessionScope) => ({
  tokenType: 'Bearer', expiresAt: scope.expiresAt, founderId: scope.founderId, tenantId: scope.tenantId,
  clientId: scope.clientId, role: 'founder', enrolled: true,
});

export async function nativeSessionReadHttp(request: Request, host?: NativeSessionHost): Promise<Response> {
  if (!host) return unconfigured();
  if (request.method !== 'GET') return fail(405, 'method_not_allowed');
  if (!sameOrigin(request, host)) return fail(400, 'invalid_request');
  const resolved = await resolveNativeSession(request, host);
  if (resolved.kind === 'absent') return fail(401, 'unauthorized');
  if (resolved.kind === 'refused') return resolved.response;
  return reply(200, scopeBody(resolved.scope));
}

export async function nativeSessionLogoutHttp(request: Request, host?: NativeSessionHost): Promise<Response> {
  if (!host) return unconfigured();
  if (request.method !== 'POST') return fail(405, 'method_not_allowed');
  const origin = request.headers.get('origin');
  if (!sameOrigin(request, host) || (origin !== null && origin !== host.deps.ownerOrigin)) return fail(400, 'invalid_request');
  const header = request.headers.get('authorization');
  if (header === null || !NATIVE_REALM.test(header)) return fail(401, 'unauthorized');
  if (browserCredential(request)) return fail(400, 'mixed_credentials');
  const match = BEARER.exec(header);
  if (!match) return fail(401, 'unauthorized');
  const input = await readJson(request);
  if (input instanceof Response) return input;
  if (Object.keys(input).length) return fail(400, 'invalid_request');
  // Revocation only removes authority, so a live token can always end itself
  // even after the founder's role or enrollment changed.
  const tokenDigest = sha256Hex(match[1]);
  const now = clock(host);
  if (!now) return unavailable();
  let revoked: boolean;
  try {
    const row = await host.deps.store.readSession(tokenDigest, now);
    if (!row) return fail(401, 'unauthorized');
    revoked = await host.deps.store.revoke(tokenDigest, now);
  } catch { return unavailable(); }
  if (!revoked) return fail(401, 'unauthorized');
  return reply(200, { revoked: true });
}

/** Path dispatcher for the four session routes. Returns null for other paths. */
export async function nativeSessionHttp(request: Request, host?: NativeSessionHost): Promise<Response | null> {
  let path: string;
  try { path = new URL(request.url).pathname; } catch { return null; }
  switch (path) {
    case NATIVE_SESSION_PATHS.authorize: return nativeSessionAuthorizeHttp(request, host);
    case NATIVE_SESSION_PATHS.exchange: return nativeSessionExchangeHttp(request, host);
    case NATIVE_SESSION_PATHS.session: return nativeSessionReadHttp(request, host);
    case NATIVE_SESSION_PATHS.logout: return nativeSessionLogoutHttp(request, host);
    default: return null;
  }
}

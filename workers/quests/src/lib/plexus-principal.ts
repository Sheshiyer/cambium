/**
 * Plexus-backed principal resolution for the curious mini app.
 *
 * The user's Cloudflare Access JWT (already verified by access-jwt.ts) is
 * forwarded to plexus-api.thoughtseed.space/v1/whoami — the single source of
 * truth for RBAC (D1 `plexus_identities`). Verdicts are cached in the QUESTS
 * KV keyed by JWT hash so a browsing session doesn't hammer whoami.
 *
 * Role map: Plexus admin → founder, employee → team, anything else → consultant.
 * Unregistered (whoami 404) callers floor to consultant. whoami/network errors
 * fail CLOSED to consultant rather than founder.
 */

import type { Principal } from '../rbac.ts';
import type { AccessJwtConfig } from './access-jwt.ts';
import { accessConfigured, readAccessJwt, verifyAccessJwt } from './access-jwt.ts';

export interface PlexusGateConfig extends AccessJwtConfig {
  whoamiUrl?: string; // default https://plexus-api.thoughtseed.space/v1/whoami
}

export interface PlexusKvLike {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

const DEFAULT_WHOAMI_URL = 'https://plexus-api.thoughtseed.space/v1/whoami';
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_SCHEMA_VERSION = 2;

export type PlexusResolveResult =
  | { kind: 'principal'; principal: Principal }
  | { kind: 'unauthenticated' } // Access configured but no/invalid JWT
  | { kind: 'unconfigured' };   // Plexus env unset → caller uses dev fallback

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface WhoamiSession {
  email?: unknown;
  role?: unknown;
  isActive?: unknown;
  identityId?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  return normalized.includes('@') ? normalized : null;
}

function directSession(record: Record<string, unknown>): WhoamiSession {
  return {
    email: record.email,
    role: record.role,
    isActive: record.isActive,
    identityId: record.identityId,
  };
}

function normalizeWhoamiSession(payload: unknown): WhoamiSession | null {
  if (!isRecord(payload)) return null;
  if (Object.prototype.hasOwnProperty.call(payload, 'ok')) {
    if (payload.ok !== true) return null;
    if (!isRecord(payload.data) || Object.keys(payload.data).length === 0) return null;
    if (Object.prototype.hasOwnProperty.call(payload.data, 'ok')) return null;
    return directSession(payload.data);
  }
  return Object.keys(payload).length > 0 ? directSession(payload) : null;
}

function principalFromWhoami(session: WhoamiSession, accessEmail: string): Principal {
  const sessionEmail = normalizeEmail(session.email);
  const active = session.isActive === undefined || session.isActive === true;
  const role = sessionEmail === accessEmail && active
    ? session.role === 'admin'
      ? 'founder'
      : session.role === 'employee'
        ? 'team'
        : 'consultant'
    : 'consultant';
  return {
    id: typeof session.identityId === 'string' && session.identityId.trim()
      ? session.identityId
      : `plexus:${accessEmail}`,
    tenant: '*',
    role,
    allow: [],
    createdBy: 'plexus',
  };
}

function consultantFloor(email: string): Principal {
  return { id: `plexus:${email}`, tenant: '*', role: 'consultant', allow: [], createdBy: 'plexus' };
}

function cachedPrincipal(value: unknown, accessEmail: string, nowMs: number): Principal | null {
  if (!isRecord(value)) return null;
  if (value.version !== CACHE_SCHEMA_VERSION || value.accessEmail !== accessEmail) return null;
  if (typeof value.cachedAt !== 'number' || !Number.isFinite(value.cachedAt)) return null;
  const ageMs = nowMs - value.cachedAt;
  if (ageMs < 0 || ageMs >= CACHE_TTL_MS || !isRecord(value.principal)) return null;

  const principal = value.principal;
  if (
    typeof principal.id !== 'string'
    || typeof principal.tenant !== 'string'
    || (principal.role !== 'founder' && principal.role !== 'team' && principal.role !== 'consultant')
    || !Array.isArray(principal.allow)
    || !principal.allow.every((entry) => typeof entry === 'string')
    || principal.createdBy !== 'plexus'
  ) return null;

  return {
    id: principal.id,
    tenant: principal.tenant,
    role: principal.role,
    allow: principal.allow,
    createdBy: principal.createdBy,
  };
}

/**
 * Resolve the request's principal from Plexus. Returns 'unconfigured' when the
 * gate env is unset (dev founder-fallback path), 'unauthenticated' when Access
 * is configured but the JWT is missing/invalid (caller should 401), otherwise a
 * role-mapped Principal (never worse than consultant on downstream failures).
 */
export async function resolvePlexusPrincipal(
  headers: Record<string, string>,
  cfg: PlexusGateConfig,
  kv: PlexusKvLike,
  fetchImpl: typeof fetch = fetch,
): Promise<PlexusResolveResult> {
  if (!accessConfigured(cfg)) return { kind: 'unconfigured' };

  const identity = await verifyAccessJwt(headers, cfg, fetchImpl);
  const jwt = readAccessJwt(headers);
  if (!identity || !jwt) return { kind: 'unauthenticated' };
  const accessEmail = normalizeEmail(identity.email);
  if (!accessEmail) return { kind: 'unauthenticated' };

  const cacheKey = `plexus:whoami:${await sha256Hex(jwt)}`;
  try {
    const cached = await kv.get(cacheKey);
    if (cached) {
      const principal = cachedPrincipal(JSON.parse(cached) as unknown, accessEmail, Date.now());
      if (principal) return { kind: 'principal', principal };
    }
  } catch { /* cache miss / parse failure → fall through to live lookup */ }

  let principal: Principal;
  try {
    const res = await fetchImpl(cfg.whoamiUrl ?? DEFAULT_WHOAMI_URL, {
      headers: { 'cf-access-jwt-assertion': jwt, 'accept': 'application/json' },
    });
    if (res.status === 404) {
      principal = consultantFloor(accessEmail); // valid Access login, no Plexus identity
    } else if (!res.ok) {
      principal = consultantFloor(accessEmail); // whoami degraded → fail closed
    } else {
      const session = normalizeWhoamiSession(await res.json());
      principal = session ? principalFromWhoami(session, accessEmail) : consultantFloor(accessEmail);
    }
  } catch {
    principal = consultantFloor(accessEmail);
  }

  try {
    await kv.put(cacheKey, JSON.stringify({
      version: CACHE_SCHEMA_VERSION,
      accessEmail,
      cachedAt: Date.now(),
      principal,
    }));
  } catch { /* cache write failure is non-fatal */ }

  return { kind: 'principal', principal };
}

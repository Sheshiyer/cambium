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

export type PlexusResolveResult =
  | { kind: 'principal'; principal: Principal }
  | { kind: 'unauthenticated' } // Access configured but no/invalid JWT
  | { kind: 'unconfigured' };   // Plexus env unset → caller uses dev fallback

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface WhoamiBody {
  email?: string;
  role?: string;
  isActive?: boolean;
  identityId?: string;
  displayName?: string;
}

function principalFromWhoami(body: WhoamiBody, email: string): Principal {
  const role = body.isActive === false
    ? 'consultant'
    : body.role === 'admin'
      ? 'founder'
      : body.role === 'employee'
        ? 'team'
        : 'consultant';
  return {
    id: body.identityId ?? `plexus:${email}`,
    tenant: '*',
    role,
    allow: [],
    createdBy: 'plexus',
  };
}

function consultantFloor(email: string): Principal {
  return { id: `plexus:${email}`, tenant: '*', role: 'consultant', allow: [], createdBy: 'plexus' };
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

  const cacheKey = `plexus:whoami:${await sha256Hex(jwt)}`;
  try {
    const cached = await kv.get(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached) as { cachedAt?: number; principal?: Principal };
      if (parsed.principal && typeof parsed.cachedAt === 'number' && Date.now() - parsed.cachedAt < CACHE_TTL_MS) {
        return { kind: 'principal', principal: parsed.principal };
      }
    }
  } catch { /* cache miss / parse failure → fall through to live lookup */ }

  let principal: Principal;
  try {
    const res = await fetchImpl(cfg.whoamiUrl ?? DEFAULT_WHOAMI_URL, {
      headers: { 'cf-access-jwt-assertion': jwt, 'accept': 'application/json' },
    });
    if (res.status === 404) {
      principal = consultantFloor(identity.email); // valid Access login, no Plexus identity
    } else if (!res.ok) {
      principal = consultantFloor(identity.email); // whoami degraded → fail closed
    } else {
      principal = principalFromWhoami((await res.json()) as WhoamiBody, identity.email);
    }
  } catch {
    principal = consultantFloor(identity.email);
  }

  try {
    await kv.put(cacheKey, JSON.stringify({ cachedAt: Date.now(), principal }));
  } catch { /* cache write failure is non-fatal */ }

  return { kind: 'principal', principal };
}

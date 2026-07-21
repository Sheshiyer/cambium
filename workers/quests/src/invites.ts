// cambium-quests · consultant invite subsystem (zero-dependency, node:crypto HMAC-SHA256).
//
// Creates signed invite tokens that carry a consultant principal.  Every
// invite-scoped principal has role 'consultant' regardless of who created it.
// The token is a URL-safe base64 payload + HMAC-SHA256 signature; the secret
// is passed as a parameter, never hardcoded.
//
// Verification checks signature, expiry (expiresAt < now → expired, equal-to-now
// valid per rbac convention), and structural validity.  Revocation is separate
// — a caller checks the store after verification.

import { createHmac, randomUUID } from 'node:crypto';
import type { Principal } from './rbac.ts';

// ── internal helpers ──────────────────────────────────────────────────────

const b64url = (data: string): string => Buffer.from(data).toString('base64url');
const b64urlDecode = (s: string): Buffer => Buffer.from(s, 'base64url');

function hmac(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

function sign(secret: string, claims: Record<string, unknown>): string {
  const payload = b64url(JSON.stringify(claims));
  return `${payload}.${hmac(secret, payload)}`;
}

// ── public API ────────────────────────────────────────────────────────────

export function createInvite(params: {
  tenant: string;
  allow: readonly string[];
  createdBy: string;
  ttlMs: number;
  now: Date;
  secret: string;
}): { token: string; principal: Principal } {
  const { tenant, allow, createdBy, ttlMs, now, secret } = params;
  const id = randomUUID();
  const exp = now.getTime() + ttlMs;
  const claims = { id, tenant, allow, createdBy, exp, role: 'consultant' as const };
  const token = sign(secret, claims);
  const principal: Principal = {
    id,
    tenant,
    role: 'consultant',
    allow: [...allow],
    createdBy,
    expiresAt: new Date(exp).toISOString(),
  };
  return { token, principal };
}

export function verifyInvite(
  token: string,
  secret: string,
  now: Date,
): { ok: true; principal: Principal } | { ok: false; reason: 'expired' | 'bad-signature' | 'malformed' } {
  const dot = token.indexOf('.');
  if (dot < 1) return { ok: false, reason: 'malformed' };

  const payload64 = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!payload64 || !sig) return { ok: false, reason: 'malformed' };

  if (hmac(secret, payload64) !== sig) return { ok: false, reason: 'bad-signature' };

  let claims: Record<string, unknown>;
  try {
    const raw = b64urlDecode(payload64).toString('utf-8');
    claims = JSON.parse(raw);
    if (!claims || typeof claims !== 'object' || Array.isArray(claims)) throw new Error('bad shape');
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (typeof claims.exp !== 'number' || typeof claims.id !== 'string' ||
      typeof claims.tenant !== 'string' || typeof claims.createdBy !== 'string' ||
      !Array.isArray(claims.allow)) {
    return { ok: false, reason: 'malformed' };
  }

  // expiresAt < now → expired, equal-to-now valid per rbac convention
  if (claims.exp < now.getTime()) return { ok: false, reason: 'expired' };

  const principal: Principal = {
    id: claims.id,
    tenant: claims.tenant,
    role: 'consultant',
    allow: claims.allow as string[],
    createdBy: claims.createdBy,
    expiresAt: new Date(claims.exp).toISOString(),
  };
  return { ok: true, principal };
}

// ── in-memory revoke store ────────────────────────────────────────────────

export interface InviteStore {
  issue(token: string): void;
  revoke(token: string): void;
  isRevoked(token: string): boolean;
}

export function makeInviteStore(): InviteStore {
  const revoked = new Set<string>();
  return {
    issue() { /* no-op — revoke-only index */ },
    revoke(token: string) { revoked.add(token); },
    isRevoked(token: string) { return revoked.has(token); },
  };
}

export function revokeInvite(token: string, store: InviteStore): void {
  store.revoke(token);
}

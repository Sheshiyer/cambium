// D1 authority for native founder sessions (cambium.native-session.v1).
//
// Exchange is ONE conditional INSERT ... SELECT into native_sessions. It reads
// founder and tenant from the stored code row and only inserts when that row
// matches the code digest, client, exact redirect, the S256 challenge computed
// from the presented verifier, and an unexpired code. The unique
// authorization_code_id (migration 0100) makes parallel or replayed exchanges
// yield at most one session; the loser sees changes = 0 or a unique violation.
// There is no read-then-consume claim. SQL string equality is not described as
// cryptographic constant-time comparison; credentials are 256-bit random values
// stored only as SHA-256 digests.
//
// A store failure during grant is ambiguous (the insert may have landed). The
// caller never resends; the single-use code simply cannot mint a second session.

import type { GoalGraphD1DatabaseLike } from './goal-graph-store.ts';
import type {
  NativeAuthorizationCodeRecord,
  NativeSessionScope,
  NativeSessionStore,
} from './native-session.ts';

type Row = Record<string, unknown>;

const isUniqueViolation = (error: unknown) =>
  /UNIQUE constraint failed|SQLITE_CONSTRAINT|PRIMARY KEY/i.test(String((error as Error)?.message ?? error));

export function d1NativeSessionStore(db: GoalGraphD1DatabaseLike): NativeSessionStore {
  return {
    async saveCode(record: NativeAuthorizationCodeRecord) {
      await db.prepare(`
        INSERT INTO native_authorization_codes
          (code_digest, client_id, redirect_uri, code_challenge, founder_id, tenant_id, issued_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(record.codeDigest, record.clientId, record.redirectUri, record.codeChallenge,
        record.founderId, record.tenantId, record.issuedAt, record.expiresAt).run();
    },

    async peekCode(match) {
      const row = await db.prepare(`
        SELECT c.founder_id, c.tenant_id, c.expires_at
        FROM native_authorization_codes c
        WHERE c.code_digest = ? AND c.client_id = ? AND c.redirect_uri = ? AND c.code_challenge = ?
          AND c.expires_at > ?
          AND NOT EXISTS (SELECT 1 FROM native_sessions s WHERE s.authorization_code_id = c.code_digest)
        LIMIT 1
      `).bind(match.codeDigest, match.clientId, match.redirectUri, match.codeChallenge, match.now).first<Row>();
      return row ? { founderId: String(row.founder_id), tenantId: String(row.tenant_id), expiresAt: String(row.expires_at) } : null;
    },

    async grant(input) {
      try {
        const result = await db.prepare(`
          INSERT INTO native_sessions
            (token_digest, authorization_code_id, client_id, founder_id, tenant_id, issued_at, expires_at, revoked_at)
          SELECT ?, c.code_digest, c.client_id, c.founder_id, c.tenant_id, ?, ?, NULL
          FROM native_authorization_codes c
          WHERE c.code_digest = ? AND c.client_id = ? AND c.redirect_uri = ? AND c.code_challenge = ?
            AND c.expires_at > ? AND c.founder_id = ? AND c.tenant_id = ?
        `).bind(input.tokenDigest, input.now, input.expiresAt, input.codeDigest, input.clientId,
          input.redirectUri, input.codeChallenge, input.now, input.founderId, input.tenantId).run();
        return Number(result.meta?.changes ?? 0) === 1;
      } catch (error) {
        if (isUniqueViolation(error)) return false;
        throw error;
      }
    },

    async readSession(tokenDigest, now): Promise<NativeSessionScope | null> {
      const row = await db.prepare(`
        SELECT founder_id, tenant_id, client_id, expires_at FROM native_sessions
        WHERE token_digest = ? AND revoked_at IS NULL AND expires_at > ? LIMIT 1
      `).bind(tokenDigest, now).first<Row>();
      return row ? {
        founderId: String(row.founder_id), tenantId: String(row.tenant_id),
        clientId: String(row.client_id), expiresAt: String(row.expires_at),
      } : null;
    },

    async revoke(tokenDigest, now) {
      const result = await db.prepare(`
        UPDATE native_sessions SET revoked_at = ? WHERE token_digest = ? AND revoked_at IS NULL
      `).bind(now, tokenDigest).run();
      return Number(result.meta?.changes ?? 0) === 1;
    },
  };
}

/**
 * Removes expired hashed metadata. Pure helper: nothing schedules it in this
 * packet. Sessions go first so a code is only removed once no session needs it.
 */
export async function cleanupExpiredNativeSessions(db: GoalGraphD1DatabaseLike, cutoff: string): Promise<{ sessions: number; codes: number }> {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(cutoff)) throw new Error('native_session_cleanup_cutoff_invalid');
  const parsed = Date.parse(cutoff);
  if (!Number.isFinite(parsed)) throw new Error('native_session_cleanup_cutoff_invalid');
  let canonical: string;
  try { canonical = new Date(parsed).toISOString(); } catch { throw new Error('native_session_cleanup_cutoff_invalid'); }
  if (canonical !== cutoff) throw new Error('native_session_cleanup_cutoff_invalid');
  const sessions = await db.prepare('DELETE FROM native_sessions WHERE expires_at <= ?').bind(cutoff).run();
  const codes = await db.prepare(`
    DELETE FROM native_authorization_codes
    WHERE expires_at <= ? AND NOT EXISTS (SELECT 1 FROM native_sessions s WHERE s.authorization_code_id = native_authorization_codes.code_digest)
  `).bind(cutoff).run();
  return { sessions: Number(sessions.meta?.changes ?? 0), codes: Number(codes.meta?.changes ?? 0) };
}

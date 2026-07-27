/**
 * Cloudflare Access JWT validation for the curious mini app gate.
 *
 * Ported from team-forge-ts/cloudflare/worker/src/lib/access.ts and adapted to
 * this Worker's SimpleRequest (lower-cased header record) and a named-config
 * Env. Reuses the existing plexus-api / forge Access apps on team
 * red-queen-4dfa — TF_ACCESS_AUD holds their comma-separated AUDs.
 *
 * Fail-open only when unconfigured: returns null when TF_ACCESS_TEAM_DOMAIN /
 * TF_ACCESS_AUD are unset so the dev founder-fallback path stays alive.
 */

export interface AccessIdentity {
  email: string;
}

export interface AccessJwtConfig {
  teamDomain?: string;
  aud?: string;
}

interface Jwk {
  kid: string;
  [k: string]: unknown;
}

let jwksCache: { domain: string; keys: Jwk[]; fetchedAt: number } | null = null;

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  let t = s.replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  const bin = atob(t);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function decodeSegment(seg: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(seg)));
}

function readCookie(headers: Record<string, string>, name: string): string | null {
  const cookie = headers['cookie'];
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}

async function getJwks(domain: string, fetchImpl: typeof fetch): Promise<Jwk[]> {
  if (jwksCache && jwksCache.domain === domain && Date.now() - jwksCache.fetchedAt < 3_600_000) {
    return jwksCache.keys;
  }
  const res = await fetchImpl(`https://${domain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`);
  const data = (await res.json()) as { keys?: Jwk[] };
  jwksCache = { domain, keys: data.keys ?? [], fetchedAt: Date.now() };
  return jwksCache.keys;
}

/** Extract the raw Access JWT from headers (assertion header or cookie). */
export function readAccessJwt(headers: Record<string, string>): string | null {
  return headers['cf-access-jwt-assertion'] ?? readCookie(headers, 'CF_Authorization');
}

export function accessConfigured(cfg: AccessJwtConfig): boolean {
  const auds = (cfg.aud ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return Boolean(cfg.teamDomain) && auds.length > 0;
}

export async function verifyAccessJwt(
  headers: Record<string, string>,
  cfg: AccessJwtConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<AccessIdentity | null> {
  const domain = cfg.teamDomain;
  const audAllowed = (cfg.aud ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!domain || audAllowed.length === 0) return null;

  const token = readAccessJwt(headers);
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const header = decodeSegment(parts[0]) as { kid?: string; alg?: string };
    const payload = decodeSegment(parts[1]) as {
      exp?: number; iss?: string; aud?: string | string[]; email?: string; identity?: string;
    };

    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp < nowSec) return null;
    if (payload.iss && payload.iss !== `https://${domain}`) return null;
    const auds = Array.isArray(payload.aud) ? payload.aud : payload.aud ? [payload.aud] : [];
    if (!auds.some((a) => audAllowed.includes(a))) return null;

    const keys = await getJwks(domain, fetchImpl);
    const jwk = keys.find((k) => k.kid === header.kid);
    if (!jwk) return null;

    const key = await crypto.subtle.importKey(
      "jwk",
      jwk as JsonWebKey,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      b64urlToBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    );
    if (!ok) return null;

    const email = payload.email ?? payload.identity;
    if (!email) return null;
    return { email: String(email).toLowerCase() };
  } catch {
    return null;
  }
}

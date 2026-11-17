import { writeAudit } from "./audit.ts";
import type { Deps } from "./deps.ts";
import type { CuriousDb } from "./db.ts";
import { base64Url, json, sha256Hex } from "./http.ts";
import { verifyAccessJwt } from "./access.ts";
import { ALETHEIOS_AGENT, DEFAULT_TTL_SECONDS, isGrantableScope, MAX_TTL_SECONDS, scopeAllows } from "./scopes.ts";

export interface Principal {
  tokenId: string;
  agent: string;
  scopes: string[];
}

interface TokenRow {
  id: string;
  token_hash: string;
  agent: string;
  scopes: string;
  expires_at: string;
}

function bearer(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer (.+)$/.exec(header);
  return match ? match[1] : null;
}

export async function installIssuerCredential(db: CuriousDb, rawToken: string, at: string): Promise<void> {
  const existing = await db.get("SELECT id FROM tokens WHERE id = ?1", ["issuer-aletheios"]);
  if (existing) return;
  const expires = new Date(Date.parse(at) + DEFAULT_TTL_SECONDS * 1000).toISOString();
  await db.run(
    "INSERT INTO tokens (id, token_hash, agent, scopes, issued_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
    ["issuer-aletheios", await sha256Hex(rawToken), ALETHEIOS_AGENT, JSON.stringify(["tokens:issue"]), at, expires],
  );
}

export async function authenticate(db: CuriousDb, request: Request, now: Date): Promise<{ principal: Principal } | { error: Response }> {
  const raw = bearer(request);
  const at = now.toISOString();
  if (!raw) {
    await writeAudit(db, { at, action: "deny", actor: "anonymous", detail: { reason: "missing_token" } });
    return { error: json(401, { ok: false, error: "denied" }) };
  }
  const tokenHash = await sha256Hex(raw);
  const revoked = await db.get<{ token_hash: string }>("SELECT token_hash FROM token_revocations WHERE token_hash = ?1", [tokenHash]);
  if (revoked) {
    await writeAudit(db, { at, action: "deny", actor: "revoked", detail: { reason: "revoked" } });
    return { error: json(403, { ok: false, error: "denied" }) };
  }
  const row = await db.get<TokenRow>("SELECT id, token_hash, agent, scopes, expires_at FROM tokens WHERE token_hash = ?1", [tokenHash]);
  if (!row) {
    await writeAudit(db, { at, action: "deny", actor: "unknown", detail: { reason: "unknown_token" } });
    return { error: json(401, { ok: false, error: "denied" }) };
  }
  if (Date.parse(row.expires_at) <= now.getTime()) {
    await writeAudit(db, { at, action: "deny", actor: row.agent, subject: row.id, detail: { reason: "expired" } });
    return { error: json(403, { ok: false, error: "denied" }) };
  }
  const presentedAgent = request.headers.get("x-curious-agent");
  if (!presentedAgent || presentedAgent !== row.agent) {
    await writeAudit(db, { at, action: "deny", actor: presentedAgent || row.agent, subject: row.id, detail: { reason: "agent_mismatch" } });
    return { error: json(403, { ok: false, error: "denied" }) };
  }
  const scopes = JSON.parse(row.scopes) as string[];
  await writeAudit(db, { at, action: "use", actor: row.agent, subject: row.id, detail: { path: new URL(request.url).pathname } });
  return { principal: { tokenId: row.id, agent: row.agent, scopes } };
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > 65536) throw new Error("body_too_large");
  return JSON.parse(text);
}

export async function issueToken(db: CuriousDb, request: Request, principal: Principal, deps: Deps): Promise<Response> {
  if (principal.agent !== ALETHEIOS_AGENT || !principal.scopes.includes("tokens:issue") || principal.scopes.length !== 1) {
    await writeAudit(db, { at: deps.now().toISOString(), action: "deny", actor: principal.agent, detail: { reason: "not_aletheios" } });
    return json(403, { ok: false, error: "denied" });
  }
  let body: { agent?: unknown; scopes?: unknown; ttlSeconds?: unknown };
  try {
    body = await readJson(request) as typeof body;
  } catch {
    return json(400, { ok: false, error: "invalid_body" });
  }
  if (typeof body.agent !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(body.agent)) return json(400, { ok: false, error: "invalid_agent" });
  if (!Array.isArray(body.scopes) || body.scopes.length === 0 || body.scopes.some((scope) => typeof scope !== "string" || !isGrantableScope(scope))) {
    await writeAudit(db, { at: deps.now().toISOString(), action: "deny", actor: principal.agent, detail: { reason: "scope_not_grantable" } });
    return json(403, { ok: false, error: "scope_not_grantable" });
  }
  let ttl = DEFAULT_TTL_SECONDS;
  if (body.ttlSeconds !== undefined) {
    if (typeof body.ttlSeconds !== "number" || !Number.isInteger(body.ttlSeconds) || body.ttlSeconds < 1 || body.ttlSeconds > MAX_TTL_SECONDS) {
      return json(400, { ok: false, error: "ttl_out_of_range" });
    }
    ttl = body.ttlSeconds;
  }
  const now = deps.now();
  const raw = `curious_${base64Url(deps.randomBytes(32))}`;
  const id = `tok_${base64Url(deps.randomBytes(9))}`;
  const expires = new Date(now.getTime() + ttl * 1000).toISOString();
  await db.batch([
    {
      sql: "INSERT INTO tokens (id, token_hash, agent, scopes, issued_at, expires_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
      params: [id, await sha256Hex(raw), body.agent, JSON.stringify(body.scopes), now.toISOString(), expires],
    },
    {
      sql: "INSERT INTO audit (at, action, actor, subject, detail) VALUES (?1, ?2, ?3, ?4, ?5)",
      params: [now.toISOString(), "issue", principal.agent, id, JSON.stringify({ agent: body.agent, scopes: body.scopes, ttlSeconds: ttl })],
    },
  ]);
  return json(201, { ok: true, token: raw, tokenId: id, agent: body.agent, scopes: body.scopes, expiresAt: expires });
}

export async function revokeToken(db: CuriousDb, request: Request, principal: Principal, deps: Deps): Promise<Response> {
  if (principal.agent !== ALETHEIOS_AGENT || !principal.scopes.includes("tokens:issue")) {
    await writeAudit(db, { at: deps.now().toISOString(), action: "deny", actor: principal.agent, detail: { reason: "not_aletheios" } });
    return json(403, { ok: false, error: "denied" });
  }
  let body: { tokenId?: unknown; reason?: unknown };
  try {
    body = await readJson(request) as typeof body;
  } catch {
    return json(400, { ok: false, error: "invalid_body" });
  }
  if (typeof body.tokenId !== "string" || body.tokenId.length === 0) return json(400, { ok: false, error: "invalid_token" });
  const row = await db.get<TokenRow>("SELECT id, token_hash, agent, scopes, expires_at FROM tokens WHERE id = ?1", [body.tokenId]);
  if (!row) return json(404, { ok: false, error: "not_found" });
  const at = deps.now().toISOString();
  const reason = typeof body.reason === "string" && body.reason.length <= 200 ? body.reason : "revoked";
  await db.batch([
    {
      sql: "INSERT INTO token_revocations (token_hash, token_id, revoked_at, revoked_by, reason) VALUES (?1, ?2, ?3, ?4, ?5)",
      params: [row.token_hash, row.id, at, principal.agent, reason],
    },
    {
      sql: "INSERT INTO audit (at, action, actor, subject, detail) VALUES (?1, ?2, ?3, ?4, ?5)",
      params: [at, "revoke", principal.agent, row.id, JSON.stringify({ reason })],
    },
  ]);
  return json(200, { ok: true, tokenId: row.id, revokedAt: at });
}

export async function handleApprove(db: CuriousDb, request: Request, env: { MAGE_ACCESS_IDENTITY?: string; CURIOUS_ACCESS_HMAC_KEY?: string; CURIOUS_ACCESS_AUD?: string }, deps: Deps): Promise<Response> {
  const at = deps.now().toISOString();
  if (request.headers.has("authorization")) {
    await writeAudit(db, { at, action: "deny", actor: "bearer", detail: { reason: "bearer_cannot_approve" } });
    return json(403, { ok: false, error: "bearer_cannot_approve" });
  }
  const assertion = request.headers.get("cf-access-jwt-assertion");
  if (!env.MAGE_ACCESS_IDENTITY || !env.CURIOUS_ACCESS_HMAC_KEY || !assertion) {
    await writeAudit(db, { at, action: "deny", actor: "anonymous", detail: { reason: "access_identity_required" } });
    return json(403, { ok: false, error: "access_identity_required" });
  }
  const claims = await verifyAccessJwt(assertion, env.CURIOUS_ACCESS_HMAC_KEY, env.CURIOUS_ACCESS_AUD);
  if (!claims || claims.email !== env.MAGE_ACCESS_IDENTITY) {
    await writeAudit(db, { at, action: "deny", actor: "access", detail: { reason: "access_identity_rejected" } });
    return json(403, { ok: false, error: "access_identity_rejected" });
  }
  let body: { decision?: unknown; note?: unknown; gateId?: unknown };
  try {
    body = await readJson(request) as typeof body;
  } catch {
    return json(400, { ok: false, error: "invalid_body" });
  }
  if (body.decision !== "approve" && body.decision !== "reject") return json(400, { ok: false, error: "invalid_decision" });
  const note = typeof body.note === "string" ? body.note.slice(0, 500) : "";
  const gateId = typeof body.gateId === "string" ? body.gateId : null;
  const id = `apr_${base64Url(deps.randomBytes(9))}`;
  await db.batch([
    {
      sql: "INSERT INTO approvals (id, gate_id, decision, actor, note, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
      params: [id, gateId, body.decision, env.MAGE_ACCESS_IDENTITY, note, at],
    },
    {
      sql: "INSERT INTO audit (at, action, actor, subject, detail) VALUES (?1, ?2, ?3, ?4, ?5)",
      params: [at, "approve", env.MAGE_ACCESS_IDENTITY, id, JSON.stringify({ decision: body.decision, gateId })],
    },
  ]);
  return json(201, { ok: true, approvalId: id, decision: body.decision });
}

export function sessionResponse(principal: Principal): Response {
  return json(200, { ok: true, agent: principal.agent, scopes: principal.scopes, tokenId: principal.tokenId });
}

export function hasScope(principal: Principal, required: string): boolean {
  return scopeAllows(principal.scopes, required);
}

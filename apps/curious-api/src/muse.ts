import type { CuriousDb } from "./db.ts";
import { json, sha256Hex } from "./http.ts";
import { hasScope, type Principal } from "./tokens.ts";

export const THALIA_AGENT = "thalia";

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export async function chainHashes(draftBody: string, gate: unknown, approval: unknown): Promise<{ draftHash: string; gateHash: string; approvalHash: string; receiptHash: string }> {
  const draftHash = await sha256Hex(draftBody);
  const gateHash = await sha256Hex(canonical(gate) + draftHash);
  const approvalHash = await sha256Hex(canonical(approval));
  const receiptHash = await sha256Hex(draftHash + gateHash + approvalHash);
  return { draftHash, gateHash, approvalHash, receiptHash };
}

function readOnly(principal: Principal, method: string): Response | null {
  if (principal.agent === THALIA_AGENT && method !== "GET") return json(403, { ok: false, error: "thalia_read_only" });
  return null;
}

async function insertRow(db: CuriousDb, principal: Principal, method: string, table: string, columns: string[], values: unknown[]): Promise<Response | null> {
  const denied = readOnly(principal, method);
  if (denied) return denied;
  if (!hasScope(principal, "muse:write")) return json(403, { ok: false, error: "denied" });
  const marks = columns.map((_, index) => `?${index + 1}`).join(", ");
  await db.run(`INSERT INTO ${table} (${columns.join(", ")}) VALUES (${marks})`, values);
  return null;
}

export async function handleMuse(request: Request, db: CuriousDb, principal: Principal, now: Date): Promise<Response> {
  const url = new URL(request.url);
  const at = now.toISOString();
  if (request.method === "GET" && url.pathname === "/v1/muse/signals") {
    if (!hasScope(principal, "muse:read") && !hasScope(principal, "muse:write")) return json(403, { ok: false, error: "denied" });
    return json(200, { ok: true, signals: await db.all("SELECT id, title, body, created_at FROM signals ORDER BY id") });
  }
  if (request.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
  if (url.pathname === "/v1/muse/approvals") return json(405, { ok: false, error: "approvals_use_mage_endpoint" });
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload) return json(400, { ok: false, error: "invalid_body" });
  if (url.pathname === "/v1/muse/signals") {
    const blocked = await insertRow(db, principal, request.method, "signals", ["id", "title", "body", "created_at"], [payload.id, payload.title, payload.body, at]);
    return blocked ?? json(201, { ok: true, id: payload.id });
  }
  if (url.pathname === "/v1/muse/problems") {
    const blocked = await insertRow(db, principal, request.method, "problems", ["id", "signal_id", "statement", "created_at"], [payload.id, payload.signalId, payload.statement, at]);
    return blocked ?? json(201, { ok: true, id: payload.id });
  }
  if (url.pathname === "/v1/muse/drafts") {
    const blocked = await insertRow(db, principal, request.method, "drafts", ["id", "problem_id", "body", "created_at"], [payload.id, payload.problemId, payload.body, at]);
    return blocked ?? json(201, { ok: true, id: payload.id });
  }
  if (url.pathname === "/v1/muse/gates") {
    const blocked = await insertRow(db, principal, request.method, "gates", ["id", "draft_id", "checks", "created_at"], [payload.id, payload.draftId, JSON.stringify(payload.checks ?? []), at]);
    return blocked ?? json(201, { ok: true, id: payload.id });
  }
  if (url.pathname === "/v1/muse/receipts") {
    const draft = await db.get<{ body: string }>("SELECT body FROM drafts WHERE id = ?1", [payload.draftId]);
    const gate = await db.get<{ id: string; draft_id: string; checks: string }>("SELECT id, draft_id, checks FROM gates WHERE id = ?1", [payload.gateId]);
    const approval = await db.get<{ id: string; decision: string; actor: string }>("SELECT id, decision, actor FROM approvals WHERE id = ?1", [payload.approvalId]);
    if (!draft || !gate || !approval) return json(409, { ok: false, error: "receipt_prerequisites_missing" });
    const hashes = await chainHashes(draft.body, { id: gate.id, draftId: gate.draft_id, checks: JSON.parse(gate.checks) }, approval);
    const blocked = await insertRow(db, principal, request.method, "receipts", ["id", "gate_id", "approval_id", "draft_hash", "gate_hash", "approval_hash", "receipt_hash", "created_at"], [payload.id, payload.gateId, payload.approvalId, hashes.draftHash, hashes.gateHash, hashes.approvalHash, hashes.receiptHash, at]);
    return blocked ?? json(201, { ok: true, id: payload.id, ...hashes });
  }
  return json(404, { ok: false, error: "not_found" });
}


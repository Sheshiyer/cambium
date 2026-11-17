import type { CuriousDb } from "./db.ts";
import { decryptPersonal, encryptPersonal } from "./field-key.ts";
import { json } from "./http.ts";
import { findSensitive } from "./sensitive.ts";
import { hasScope, type Principal } from "./tokens.ts";

export const TOMBSTONE_MS = 30 * 24 * 60 * 60 * 1000;

interface NodeRow {
  id: string;
  tenant_id: string;
  kind: string;
  body: string;
  personal_ciphertext: string | null;
  deleted_at: string | null;
  purge_after: string | null;
  owner_agent: string | null;
}

function canReadPersonal(principal: Principal): boolean {
  return hasScope(principal, "library:personal:read");
}

export async function putLibraryNode(db: CuriousDb, principal: Principal, payload: unknown, now: Date, fieldKey?: string): Promise<Response> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return json(400, { ok: false, error: "invalid_body" });
  const sensitive = findSensitive(payload);
  if (sensitive) return json(400, { ok: false, error: "sensitive_rejected" });
  const record = payload as { id?: unknown; tenantId?: unknown; title?: unknown; body?: unknown; personal?: unknown };
  if (typeof record.id !== "string" || typeof record.tenantId !== "string" || typeof record.title !== "string") {
    return json(400, { ok: false, error: "invalid_body" });
  }
  const personal = "personal" in record ? record.personal : undefined;
  if (personal !== undefined && !hasScope(principal, "library:personal:write")) return json(403, { ok: false, error: "personal_scope_required" });
  if (personal === undefined && !hasScope(principal, "library:write")) return json(403, { ok: false, error: "denied" });
  let ciphertext: string | null = null;
  if (personal !== undefined) {
    if (!fieldKey) return json(503, { ok: false, error: "field_key_unavailable" });
    ciphertext = await encryptPersonal(fieldKey, personal);
    if (!ciphertext) return json(503, { ok: false, error: "field_key_unavailable" });
  }
  const at = now.toISOString();
  const body = JSON.stringify({ title: record.title, body: record.body ?? null });
  const existing = await db.get<{ id: string }>("SELECT id FROM nodes WHERE id = ?1 AND deleted_at IS NULL", [record.id]);
  if (existing) {
    await db.run(
      "UPDATE nodes SET body = ?1, personal_ciphertext = ?2, updated_at = ?3, revision = revision + 1, owner_agent = ?4 WHERE id = ?5",
      [body, ciphertext, at, principal.agent, record.id],
    );
  } else {
    await db.run(
      "INSERT INTO nodes (id, tenant_id, kind, body, created_at, updated_at, personal_ciphertext, owner_agent) VALUES (?1, ?2, 'library', ?3, ?4, ?4, ?5, ?6)",
      [record.id, record.tenantId, body, at, ciphertext, principal.agent],
    );
  }
  await db.run(
    "INSERT INTO events (tenant_id, kind, subject_id, body, created_at) VALUES (?1, 'library_put', ?2, ?3, ?4)",
    [record.tenantId, record.id, JSON.stringify({ agent: principal.agent, personal: personal !== undefined }), at],
  );
  return json(existing ? 200 : 201, { ok: true, id: record.id });
}

export async function readLibraryNode(db: CuriousDb, principal: Principal, id: string, fieldKey?: string): Promise<Response> {
  if (!hasScope(principal, "library:read") && !canReadPersonal(principal)) return json(403, { ok: false, error: "denied" });
  const row = await db.get<NodeRow>("SELECT id, tenant_id, kind, body, personal_ciphertext, deleted_at, purge_after, owner_agent FROM nodes WHERE id = ?1", [id]);
  if (!row || row.deleted_at) return json(404, { ok: false, error: "not_found" });
  const publicBody = JSON.parse(row.body) as { title: string; body: unknown };
  const response: Record<string, unknown> = { ok: true, id: row.id, tenantId: row.tenant_id, title: publicBody.title, body: publicBody.body };
  if (canReadPersonal(principal) && row.personal_ciphertext) {
    if (!fieldKey) return json(503, { ok: false, error: "field_key_unavailable" });
    response.personal = await decryptPersonal(fieldKey, row.personal_ciphertext);
  }
  return json(200, response);
}

export async function tombstoneLibraryNode(db: CuriousDb, principal: Principal, id: string, now: Date): Promise<Response> {
  const row = await db.get<NodeRow>("SELECT id, tenant_id, kind, body, personal_ciphertext, deleted_at, purge_after, owner_agent FROM nodes WHERE id = ?1", [id]);
  if (!row || row.deleted_at) return json(404, { ok: false, error: "not_found" });
  const shared = row.personal_ciphertext === null;
  if (shared && !hasScope(principal, "library:write")) return json(403, { ok: false, error: "library_write_required" });
  if (!shared && !hasScope(principal, "library:write") && !hasScope(principal, "library:personal:write")) return json(403, { ok: false, error: "denied" });
  const deletedAt = now.toISOString();
  const purgeAfter = new Date(now.getTime() + TOMBSTONE_MS).toISOString();
  await db.run("UPDATE nodes SET deleted_at = ?1, purge_after = ?2, updated_at = ?1 WHERE id = ?3", [deletedAt, purgeAfter, id]);
  await db.run(
    "INSERT INTO events (tenant_id, kind, subject_id, body, created_at) VALUES (?1, 'library_tombstone', ?2, ?3, ?4)",
    [row.tenant_id, id, JSON.stringify({ purgeAfter, personal: row.personal_ciphertext !== null }), deletedAt],
  );
  return json(200, { ok: true, id, deletedAt, purgeAfter });
}

export async function wipeExpired(db: CuriousDb, principal: Principal, now: Date): Promise<Response> {
  if (!hasScope(principal, "library:write")) return json(403, { ok: false, error: "denied" });
  const at = now.toISOString();
  const due = await db.all<{ id: string; tenant_id: string }>(
    "SELECT id, tenant_id FROM nodes WHERE purge_after IS NOT NULL AND purge_after <= ?1",
    [at],
  );
  if (due.length > 0) {
    await db.run(
      "DELETE FROM edges WHERE from_id IN (SELECT id FROM nodes WHERE purge_after IS NOT NULL AND purge_after <= ?1) OR to_id IN (SELECT id FROM nodes WHERE purge_after IS NOT NULL AND purge_after <= ?1)",
      [at],
    );
    await db.run("DELETE FROM nodes WHERE purge_after IS NOT NULL AND purge_after <= ?1", [at]);
    for (const row of due) {
      await db.run(
        "INSERT INTO events (tenant_id, kind, subject_id, body, created_at) VALUES (?1, 'library_wipe', ?2, '{}', ?3)",
        [row.tenant_id, row.id, at],
      );
    }
  }
  return json(200, { ok: true, wiped: due.map((row) => row.id) });
}

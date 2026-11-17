import type { CuriousDb } from "./db.ts";
import { json, sha256Hex } from "./http.ts";
import { hasScope, type Principal } from "./tokens.ts";

const COLLECTIONS = ["products", "drafts", "repositories", "hosts", "boards", "ideas", "editorial", "workItems"] as const;
const KINDS: Record<(typeof COLLECTIONS)[number], string> = {
  products: "product",
  drafts: "draft",
  repositories: "repository",
  hosts: "host",
  boards: "board",
  ideas: "idea",
  editorial: "editorial",
  workItems: "workItem",
};

export interface FieldPlan {
  id: string;
  revision: number;
  body: string;
  previous: string | null;
}

export interface ProjectedRecord {
  key: string;
  kind: string;
  id: string;
  body: string;
}

export function projectSnapshot(snapshot: unknown): { records: ProjectedRecord[]; edges: { from: string; to: string; type: string; body: string }[] } {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw new Error("invalid_snapshot");
  const value = snapshot as Record<string, unknown>;
  if (typeof value.observedAt !== "string" || !value.observedAt) throw new Error("invalid_snapshot");
  if (!Array.isArray(value.products) || !Array.isArray(value.drafts)) throw new Error("invalid_snapshot");
  const records: ProjectedRecord[] = [];
  const seen = new Set<string>();
  for (const collection of COLLECTIONS) {
    const rows = value[collection] ?? [];
    if (!Array.isArray(rows)) throw new Error("invalid_snapshot");
    rows.forEach((row, index) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("invalid_snapshot");
      const source = row as { id?: unknown };
      if (source.id !== undefined && (typeof source.id !== "string" || source.id.length === 0)) throw new Error("invalid_snapshot");
      const id = typeof source.id === "string" ? source.id : `${KINDS[collection]}-${index}`;
      const key = `${KINDS[collection]}:${id}`;
      if (seen.has(key)) throw new Error("duplicate_identity");
      seen.add(key);
      records.push({ key, kind: KINDS[collection], id, body: JSON.stringify(row) });
    });
  }
  const edges = value.edges === undefined ? [] : value.edges;
  if (!Array.isArray(edges)) throw new Error("invalid_snapshot");
  return {
    records,
    edges: edges.map((edge) => {
      if (!edge || typeof edge !== "object" || Array.isArray(edge)) throw new Error("invalid_snapshot");
      const row = edge as { from?: unknown; to?: unknown; type?: unknown };
      if (typeof row.from !== "string" || typeof row.to !== "string") throw new Error("invalid_snapshot");
      return { from: row.from, to: row.to, type: typeof row.type === "string" ? row.type : "relationship", body: JSON.stringify(edge) };
    }),
  };
}

function readPlan(value: unknown): FieldPlan | null {
  if (value === undefined || value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_plan");
  const plan = value as { id?: unknown; revision?: unknown; body?: unknown; previous?: unknown; bodies?: unknown };
  if ("bodies" in plan) throw new Error("invalid_plan");
  if (typeof plan.id !== "string" || typeof plan.revision !== "number" || typeof plan.body !== "string") throw new Error("invalid_plan");
  if (plan.previous !== null && plan.previous !== undefined && typeof plan.previous !== "string") throw new Error("invalid_plan");
  return { id: plan.id, revision: plan.revision, body: plan.body, previous: plan.previous ?? null };
}

const SYNC_NAMESPACES = ["items", "organPlacements", "fitFeedback", "libraryRemoved", "bookmarkBindings", "agentHandoffs", "libraryTrash", "meta"];
const SYNC_META = ["fieldTheoryImport", "personalCollection", "sharedReferenceImport", "libraryTheme", "libraryExperience", "quietMode"];
const FORBIDDEN_PATCH_KEY = /^(?:__proto__|constructor|prototype)$|api.?key|token|secret|password/i;

interface ExtensionRecord {
  key: string;
  data: Record<string, unknown>;
  fields: Record<string, number>;
  revision: number;
}

function extensionKey(key: string): { ns: string; id: string } | null {
  try {
    const parsed = JSON.parse(key) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== 2) return null;
    const [ns, id] = parsed;
    if (typeof ns !== "string" || typeof id !== "string" || !id || id.length > 220) return null;
    if (!SYNC_NAMESPACES.includes(ns)) return null;
    if (ns === "meta" && !SYNC_META.includes(id)) return null;
    return { ns, id };
  } catch {
    return null;
  }
}

function sameJson(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

export async function syncExtensionPayload(db: CuriousDb, principal: Principal, message: { cursor?: unknown; operations?: unknown }, now: Date): Promise<Response> {
  if (typeof message.cursor !== "number" || !Number.isSafeInteger(message.cursor) || message.cursor < 0) return json(400, { ok: false, error: "invalid_cursor" });
  if (!Array.isArray(message.operations)) return json(400, { ok: false, error: "invalid_operations" });
  const writing = message.operations.length > 0;
  if (writing && !hasScope(principal, "field:write")) return json(403, { ok: false, error: "denied" });
  if (!writing && !hasScope(principal, "field:read") && !hasScope(principal, "field:write")) return json(403, { ok: false, error: "denied" });
  const operations: { id: string; key: string; patch: Record<string, unknown>; base: Record<string, number> }[] = [];
  for (const item of message.operations) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return json(400, { ok: false, error: "invalid_operation" });
    const op = item as { id?: unknown; key?: unknown; patch?: unknown; base?: unknown };
    if (typeof op.id !== "string" || !op.id || op.id.length > 180 || typeof op.key !== "string" || op.key.length > 400) return json(400, { ok: false, error: "invalid_operation" });
    if (!extensionKey(op.key)) return json(400, { ok: false, error: "invalid_operation" });
    if (!op.patch || typeof op.patch !== "object" || Array.isArray(op.patch)) return json(400, { ok: false, error: "invalid_operation" });
    const patch = op.patch as Record<string, unknown>;
    const base = op.base && typeof op.base === "object" && !Array.isArray(op.base) ? op.base as Record<string, unknown> : {};
    const baseRevisions: Record<string, number> = {};
    for (const [key, value] of Object.entries(patch)) {
      if (FORBIDDEN_PATCH_KEY.test(key) || key.length > 100) return json(400, { ok: false, error: "forbidden_field" });
      const revision = base[key] ?? 0;
      if (typeof revision !== "number" || !Number.isSafeInteger(revision) || revision < 0) return json(400, { ok: false, error: "invalid_operation" });
      baseRevisions[key] = revision;
    }
    operations.push({ id: op.id, key: op.key, patch, base: baseRevisions });
  }
  const receipts = [];
  for (const op of operations) {
    const stored = await db.get<{ data: string; fields: string; revision: number }>("SELECT data, fields, revision FROM field_sync_records WHERE record_key = ?1", [op.key]);
    const current: ExtensionRecord | null = stored
      ? { key: op.key, data: JSON.parse(stored.data) as Record<string, unknown>, fields: JSON.parse(stored.fields) as Record<string, number>, revision: stored.revision }
      : null;
    const data = { ...(current?.data ?? {}) };
    const fields = { ...(current?.fields ?? {}) };
    let revision = current?.revision ?? 0;
    const conflicts: Record<string, { local: unknown; remote: unknown; revision: number }> = {};
    let changed = false;
    for (const [key, value] of Object.entries(op.patch)) {
      const localRevision = fields[key] ?? 0;
      if (localRevision !== (op.base[key] ?? 0) && !sameJson(data[key], value)) {
        conflicts[key] = { local: value, remote: data[key] ?? null, revision: localRevision };
        continue;
      }
      if (!sameJson(data[key], value)) {
        if (value === null) delete data[key];
        else data[key] = value;
        changed = true;
      }
    }
    if (changed) {
      revision += 1;
      for (const key of Object.keys(op.patch)) if (!(key in conflicts)) fields[key] = revision;
    }
    const record: ExtensionRecord = { key: op.key, data, fields, revision };
    if (changed) {
      const at = now.toISOString();
      await db.run(
        "INSERT INTO field_sync_records (record_key, data, fields, revision, updated_at) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(record_key) DO UPDATE SET data = excluded.data, fields = excluded.fields, revision = excluded.revision, updated_at = excluded.updated_at",
        [record.key, JSON.stringify(record.data), JSON.stringify(record.fields), record.revision, at],
      );
      await db.run("INSERT INTO field_sync_changes (record_key, record) VALUES (?1, ?2)", [record.key, JSON.stringify(record)]);
    }
    receipts.push({ id: op.id, conflicts, record });
  }
  const page = await db.all<{ cursor: number; record: string }>(
    "SELECT cursor, record FROM field_sync_changes WHERE cursor > ?1 ORDER BY cursor LIMIT 51",
    [message.cursor],
  );
  const hasMore = page.length > 50;
  const visible = hasMore ? page.slice(0, 50) : page;
  const latest = await db.get<{ cursor: number }>("SELECT MAX(cursor) AS cursor FROM field_sync_changes");
  return json(200, {
    schema: "field-report-library-sync.v1",
    cursor: latest?.cursor ?? message.cursor,
    hasMore,
    receipts,
    changes: visible.map((row) => ({ record: JSON.parse(row.record) as ExtensionRecord })),
  });
}

export async function syncFieldReport(db: CuriousDb, principal: Principal, payload: unknown, now: Date): Promise<Response> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return json(400, { ok: false, error: "invalid_body" });
  const message = payload as { schema?: unknown; apply?: unknown; snapshot?: unknown; plan?: unknown; cursor?: unknown; operations?: unknown };
  if (message.schema !== "field-report-library-sync.v1") return json(400, { ok: false, error: "unknown_schema" });
  if (Array.isArray(message.operations)) return syncExtensionPayload(db, principal, message, now);
  const apply = message.apply === true;
  if (apply && !hasScope(principal, "field:write")) return json(403, { ok: false, error: "denied" });
  if (!apply && !hasScope(principal, "field:read") && !hasScope(principal, "field:write")) return json(403, { ok: false, error: "denied" });
  let projected: ReturnType<typeof projectSnapshot>;
  let plan: FieldPlan | null;
  try {
    projected = message.snapshot === undefined ? { records: [], edges: [] } : projectSnapshot(message.snapshot);
    plan = readPlan(message.plan);
  } catch (error) {
    return json(400, { ok: false, error: error instanceof Error ? error.message : "invalid_body" });
  }
  const recordDiff = { add: [] as string[], change: [] as string[], same: [] as string[] };
  for (const record of projected.records) {
    const current = await db.get<{ content_sha256: string }>("SELECT content_sha256 FROM field_records WHERE source_key = ?1", [record.key]);
    const digest = await sha256Hex(record.body);
    if (!current) recordDiff.add.push(record.key);
    else if (current.content_sha256 !== digest) recordDiff.change.push(record.key);
    else recordDiff.same.push(record.key);
  }
  let planDiff: "absent" | "add" | "change" | "same" = "absent";
  if (plan) {
    const current = await db.get<{ body: string; previous: string | null }>("SELECT body, previous FROM field_expedition WHERE id = ?1", [plan.id]);
    if (!current) planDiff = "add";
    else if (current.body !== plan.body || current.previous !== plan.previous) planDiff = "change";
    else planDiff = "same";
  }
  if (apply) {
    const at = now.toISOString();
    for (const record of projected.records) {
      const digest = await sha256Hex(record.body);
      await db.run(
        "INSERT INTO field_records (source_key, kind, source_id, body, content_sha256, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(source_key) DO UPDATE SET body = excluded.body, content_sha256 = excluded.content_sha256, updated_at = excluded.updated_at",
        [record.key, record.kind, record.id, record.body, digest, at],
      );
    }
    for (const edge of projected.edges) {
      await db.run(
        "INSERT INTO field_edges (id, from_key, to_key, kind, body) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(id) DO UPDATE SET from_key = excluded.from_key, to_key = excluded.to_key, kind = excluded.kind, body = excluded.body",
        [`${edge.from}->${edge.to}:${edge.type}`, edge.from, edge.to, edge.type, edge.body],
      );
    }
    if (plan) {
      await db.run(
        "INSERT INTO field_expedition (id, revision, body, previous) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(id) DO UPDATE SET revision = excluded.revision, body = excluded.body, previous = excluded.previous",
        [plan.id, plan.revision, plan.body, plan.previous],
      );
    }
  }
  return json(200, {
    schema: "field-report-library-sync.v1",
    dryRun: !apply,
    applied: apply,
    diff: { records: recordDiff, plan: planDiff },
  });
}

export async function readPlanBytes(db: CuriousDb, id: string): Promise<FieldPlan | null> {
  return db.get<FieldPlan>("SELECT id, revision, body, previous FROM field_expedition WHERE id = ?1", [id]);
}

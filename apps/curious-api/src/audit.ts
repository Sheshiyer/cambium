import type { CuriousDb } from "./db.ts";

export interface AuditRow {
  at: string;
  action: "issue" | "use" | "deny" | "revoke" | "approve";
  actor: string;
  subject?: string | null;
  detail: Record<string, unknown>;
}

export async function writeAudit(db: CuriousDb, row: AuditRow): Promise<void> {
  await db.run(
    "INSERT INTO audit (at, action, actor, subject, detail) VALUES (?1, ?2, ?3, ?4, ?5)",
    [row.at, row.action, row.actor, row.subject ?? null, JSON.stringify(row.detail)],
  );
}

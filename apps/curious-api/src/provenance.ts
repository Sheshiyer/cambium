import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CuriousDb } from "./db.ts";
import { sha256Hex } from "./http.ts";

export interface LedgerRow {
  id: string;
  item: string;
  state: string;
}

export function isHistoricalApprovalPath(filePath: string): boolean {
  const normalized = filePath.replaceAll("\\", "/");
  return normalized === "workspace/approvals" || normalized.startsWith("workspace/approvals/") || normalized.includes("/workspace/approvals/") || normalized === "pr-team/approvals" || normalized.startsWith("pr-team/approvals/") || normalized.includes("/pr-team/approvals/");
}

export function parseLedger(markdown: string): LedgerRow[] {
  const rows: LedgerRow[] = [];
  for (const line of markdown.split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim()).filter((cell) => cell.length > 0);
    if (cells.length !== 3 || cells[0] === "id" || cells.every((cell) => /^-+$/.test(cell))) continue;
    rows.push({ id: cells[0], item: cells[1], state: cells[2] });
  }
  return rows;
}

export async function importHistoricalFiles(db: CuriousDb, files: { path: string; text: string }[], at: string): Promise<{ events: number; derivedRows: LedgerRow[] }> {
  let events = 0;
  const derivedRows: LedgerRow[] = [];
  for (const file of files) {
    const normalized = file.path.replaceAll("\\", "/");
    if (normalized.endsWith("pr-team/ledger.md") || normalized.endsWith("/ledger.md")) {
      const digest = await sha256Hex(file.text);
      await db.run(
        "INSERT INTO ledger_items (id, source_path, body, body_sha256, created_at) VALUES (?1, ?2, ?3, ?4, ?5)",
        [`ledger:${digest.slice(0, 12)}`, normalized, file.text, digest, at],
      );
      const derived = parseLedger(file.text);
      derivedRows.push(...derived);
      await db.run(
        "INSERT INTO digests (id, kind, body, created_at) VALUES (?1, 'derived_ledger', ?2, ?3)",
        [`digest:${digest.slice(0, 12)}`, JSON.stringify({ authority: "none", derived: true, rows: derived }), at],
      );
      continue;
    }
    if (!isHistoricalApprovalPath(normalized)) continue;
    const digest = await sha256Hex(file.text);
    await db.run(
      "INSERT INTO events (tenant_id, kind, subject_id, body, created_at) VALUES ('thoughtseed', 'historical_approval', ?1, ?2, ?3)",
      [normalized, JSON.stringify({ authority: "none", path: normalized, sha256: digest }), at],
    );
    events += 1;
  }
  return { events, derivedRows };
}

export const DEFAULT_EXPORT_ROOT = "/workspace/pr-team";

export interface ExportResult {
  written: string[];
  unchanged: string[];
  conflicts: { path: string; existingHash: string; nextHash: string }[];
}

export async function exportFiles(root: string = DEFAULT_EXPORT_ROOT, files: { relativePath: string; contents: string }[]): Promise<ExportResult> {
  const result: ExportResult = { written: [], unchanged: [], conflicts: [] };
  for (const file of files) {
    if (file.relativePath.startsWith("/") || file.relativePath.split("/").includes("..")) throw new Error("refused_path");
    const full = path.join(root, file.relativePath);
    const nextHash = await sha256Hex(file.contents);
    let existing: string | null = null;
    try {
      existing = await readFile(full, "utf8");
    } catch {
      existing = null;
    }
    if (existing !== null) {
      const existingHash = await sha256Hex(existing);
      if (existingHash === nextHash) result.unchanged.push(file.relativePath);
      else result.conflicts.push({ path: file.relativePath, existingHash, nextHash });
      continue;
    }
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, file.contents, { flag: "wx" });
    result.written.push(file.relativePath);
  }
  return result;
}

/**
 * Tenant-scoped D1 persistence for branch-map transition receipts.
 *
 * Branch maps are projections, so this store only appends validated evidence.
 * It has no graph-write methods and returns a durable duplicate on replay of
 * the same receipt identity.
 */

import {
  sha256,
} from './goal-graph/identity.ts';
import {
  validateBranchMapReceipt,
} from './branch-map.ts';
import type { BranchMapReceipt } from './branch-map.ts';

export interface BranchMapReceiptD1StatementLike {
  bind(...values: unknown[]): BranchMapReceiptD1StatementLike;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results?: T[] }>;
  run(): Promise<{ meta?: { changes?: number } }>;
}

export interface BranchMapReceiptD1DatabaseLike {
  prepare(sql: string): BranchMapReceiptD1StatementLike;
}

export interface BranchMapReceiptStoreSuccess {
  status: 'stored' | 'duplicate';
  replayed: boolean;
  receipt: BranchMapReceipt;
  receiptDigest: string;
}

export interface BranchMapReceiptStoreConflict {
  status: 'conflict';
  replayed: false;
  code:
    | 'receipt_invalid'
    | 'receipt_identity_conflict'
    | 'receipt_storage_conflict'
    | 'tenant_invalid';
  errors?: readonly string[];
}

export type BranchMapReceiptStoreResult = BranchMapReceiptStoreSuccess | BranchMapReceiptStoreConflict;

export interface BranchMapReceiptRow {
  receipt_id: string;
  tenant_id: string;
  branch_id: string;
  organ_id: string;
  organ_name: string;
  from_node_id: string | null;
  to_node_id: string;
  observed_at: string;
  evidence_refs_json: string;
  source_ref: string;
  source_digest: string;
  graph_version: number;
  status: BranchMapReceipt['status'];
  receipt_digest: string;
  recorded_at: string;
}

const DIGEST_RE = /^sha256:[0-9a-f]{64}$/;

function validTenant(tenantId: unknown): tenantId is string {
  return typeof tenantId === 'string' && tenantId.trim().length > 0 && tenantId.length <= 256;
}

function receiptDigest(receipt: BranchMapReceipt): string {
  // The receipt ID is the caller's idempotency label, not evidence content.
  // Excluding it lets a retried adapter that regenerated its local ID resolve
  // to the same immutable witness through the tenant-scoped digest index.
  const { receiptId: _receiptId, ...evidence } = receipt;
  return `sha256:${sha256(evidence)}`;
}

function rowToReceipt(row: BranchMapReceiptRow | null): BranchMapReceipt | null {
  if (!row || typeof row !== 'object') return null;
  try {
    const evidenceRefs = JSON.parse(row.evidence_refs_json) as unknown;
    const receipt: BranchMapReceipt = {
      receiptId: row.receipt_id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      organId: row.organ_id,
      organName: row.organ_name,
      fromNodeId: row.from_node_id,
      toNodeId: row.to_node_id,
      observedAt: row.observed_at,
      evidenceRefs: Array.isArray(evidenceRefs) ? evidenceRefs.filter((ref): ref is string => typeof ref === 'string') : [],
      sourceRef: row.source_ref,
      sourceDigest: row.source_digest,
      graphVersion: Number(row.graph_version),
      status: row.status,
    };
    const validation = validateBranchMapReceipt(receipt, row.tenant_id, Number(row.graph_version));
    return validation.valid ? validation.value ?? null : null;
  } catch {
    return null;
  }
}

function duplicateResult(row: BranchMapReceiptRow): BranchMapReceiptStoreResult {
  const receipt = rowToReceipt(row);
  if (!receipt || !DIGEST_RE.test(row.receipt_digest)) {
    return { status: 'conflict', replayed: false, code: 'receipt_storage_conflict' };
  }
  return { status: 'duplicate', replayed: true, receipt, receiptDigest: row.receipt_digest };
}

function normalizeReceipt(input: unknown):
  | { receipt: BranchMapReceipt; digest: string }
  | { result: BranchMapReceiptStoreConflict } {
  const validation = validateBranchMapReceipt(input);
  if (!validation.valid || !validation.value) {
    return { result: {
      status: 'conflict', replayed: false, code: 'receipt_invalid', errors: validation.errors,
    } };
  }
  const receipt = validation.value;
  return { receipt, digest: receiptDigest(receipt) };
}

function rowValues(receipt: BranchMapReceipt, digest: string, recordedAt: string): unknown[] {
  return [
    receipt.receiptId,
    receipt.tenantId,
    receipt.branchId,
    receipt.organId,
    receipt.organName,
    receipt.fromNodeId,
    receipt.toNodeId,
    receipt.observedAt,
    JSON.stringify([...receipt.evidenceRefs]),
    receipt.sourceRef,
    receipt.sourceDigest,
    receipt.graphVersion,
    receipt.status,
    digest,
    recordedAt,
  ];
}

export interface BranchMapReceiptStoreLike {
  recordReceipt(receipt: BranchMapReceipt, recordedAt?: string): Promise<BranchMapReceiptStoreResult>;
  appendReceipt(receipt: BranchMapReceipt, recordedAt?: string): Promise<BranchMapReceiptStoreResult>;
  /** Short aliases used by command adapters. */
  record(receipt: BranchMapReceipt, recordedAt?: string): Promise<BranchMapReceiptStoreResult>;
  append(receipt: BranchMapReceipt, recordedAt?: string): Promise<BranchMapReceiptStoreResult>;
  getReceipt(tenantId: string, receiptId: string): Promise<BranchMapReceipt | null>;
  read(tenantId: string, receiptId: string): Promise<BranchMapReceipt | null>;
  listReceipts(tenantId: string, branchId?: string, limit?: number): Promise<BranchMapReceipt[]>;
  list(tenantId: string, branchId?: string, limit?: number): Promise<BranchMapReceipt[]>;
}

export const BRANCH_MAP_RECEIPT_READ_LIMIT = 512 as const;

export function d1BranchMapReceiptStore(db: BranchMapReceiptD1DatabaseLike): BranchMapReceiptStoreLike {
  async function getRowById(tenantId: string, receiptId: string): Promise<BranchMapReceiptRow | null> {
    return db.prepare(`
      SELECT receipt_id, tenant_id, branch_id, organ_id, organ_name, from_node_id,
        to_node_id, observed_at, evidence_refs_json, source_ref, source_digest,
        graph_version, status, receipt_digest, recorded_at
      FROM goal_graph_branch_transition_receipts
      WHERE tenant_id = ? AND receipt_id = ?
    `).bind(tenantId, receiptId).first<BranchMapReceiptRow>();
  }

  async function getRowByDigest(tenantId: string, digest: string): Promise<BranchMapReceiptRow | null> {
    return db.prepare(`
      SELECT receipt_id, tenant_id, branch_id, organ_id, organ_name, from_node_id,
        to_node_id, observed_at, evidence_refs_json, source_ref, source_digest,
        graph_version, status, receipt_digest, recorded_at
      FROM goal_graph_branch_transition_receipts
      WHERE tenant_id = ? AND receipt_digest = ?
    `).bind(tenantId, digest).first<BranchMapReceiptRow>();
  }

  async function recordReceipt(receiptInput: BranchMapReceipt, recordedAt = new Date().toISOString()): Promise<BranchMapReceiptStoreResult> {
    const normalized = normalizeReceipt(receiptInput);
    if ('result' in normalized) return normalized.result;
    const { receipt, digest } = normalized;
    if (!validTenant(receipt.tenantId)) return { status: 'conflict', replayed: false, code: 'tenant_invalid' };

    const existingById = await getRowById(receipt.tenantId, receipt.receiptId);
    if (existingById) {
      return existingById.receipt_digest === digest
        ? duplicateResult(existingById)
        : { status: 'conflict', replayed: false, code: 'receipt_identity_conflict' };
    }
    const existingByDigest = await getRowByDigest(receipt.tenantId, digest);
    if (existingByDigest) return duplicateResult(existingByDigest);

    try {
      await db.prepare(`
        INSERT INTO goal_graph_branch_transition_receipts (
          receipt_id, tenant_id, branch_id, organ_id, organ_name, from_node_id,
          to_node_id, observed_at, evidence_refs_json, source_ref, source_digest,
          graph_version, status, receipt_digest, recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(...rowValues(receipt, digest, recordedAt)).run();
      const stored = await getRowById(receipt.tenantId, receipt.receiptId);
      if (!stored) return { status: 'conflict', replayed: false, code: 'receipt_storage_conflict' };
      return { status: 'stored', replayed: false, receipt, receiptDigest: stored.receipt_digest };
    } catch {
      // A concurrent insert is an idempotent replay only if bytes match.
      const raced = await getRowById(receipt.tenantId, receipt.receiptId);
      if (raced) {
        return raced.receipt_digest === digest
          ? duplicateResult(raced)
          : { status: 'conflict', replayed: false, code: 'receipt_identity_conflict' };
      }
      return { status: 'conflict', replayed: false, code: 'receipt_storage_conflict' };
    }
  }

  async function getReceipt(tenantId: string, receiptId: string): Promise<BranchMapReceipt | null> {
    if (!validTenant(tenantId) || typeof receiptId !== 'string' || receiptId.length === 0) return null;
    return rowToReceipt(await getRowById(tenantId, receiptId));
  }

  async function listReceipts(tenantId: string, branchId?: string, limit = BRANCH_MAP_RECEIPT_READ_LIMIT): Promise<BranchMapReceipt[]> {
    if (!validTenant(tenantId)) return [];
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > BRANCH_MAP_RECEIPT_READ_LIMIT) return [];
    const result = branchId === undefined
      ? await db.prepare(`
          SELECT receipt_id, tenant_id, branch_id, organ_id, organ_name, from_node_id,
            to_node_id, observed_at, evidence_refs_json, source_ref, source_digest,
            graph_version, status, receipt_digest, recorded_at
          FROM goal_graph_branch_transition_receipts
          WHERE tenant_id = ? ORDER BY observed_at ASC, receipt_id ASC LIMIT ?
        `).bind(tenantId, limit).all<BranchMapReceiptRow>()
      : await db.prepare(`
          SELECT receipt_id, tenant_id, branch_id, organ_id, organ_name, from_node_id,
            to_node_id, observed_at, evidence_refs_json, source_ref, source_digest,
            graph_version, status, receipt_digest, recorded_at
          FROM goal_graph_branch_transition_receipts
          WHERE tenant_id = ? AND branch_id = ?
          ORDER BY observed_at ASC, receipt_id ASC LIMIT ?
        `).bind(tenantId, branchId, limit).all<BranchMapReceiptRow>();
    return (result.results ?? []).map(rowToReceipt).filter((receipt): receipt is BranchMapReceipt => receipt !== null);
  }

  return {
    recordReceipt,
    appendReceipt: recordReceipt,
    record: recordReceipt,
    append: recordReceipt,
    getReceipt,
    read: getReceipt,
    listReceipts,
    list: listReceipts,
  };
}

export const createBranchMapReceiptStore = d1BranchMapReceiptStore;
export const d1BranchTransitionReceiptStore = d1BranchMapReceiptStore;

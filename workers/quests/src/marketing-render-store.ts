import {
  MARKETING_CREATE_ADAPTER_ID,
  MARKETING_CREATE_TENANT_ID,
} from './marketing-renderer.ts';
import type {
  MarketingApprovalDecision,
  MarketingAssetDraft,
  MarketingOperatorReceipt,
  MarketingPreparedRender,
  MarketingRenderClaimInput,
  MarketingRenderClaimResult,
  MarketingRenderStoreLike,
} from './marketing-renderer.ts';

export interface MarketingD1StatementLike {
  bind(...values: unknown[]): MarketingD1StatementLike;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results?: T[] }>;
  run(): Promise<{ meta?: { changes?: number } }>;
}

export interface MarketingD1DatabaseLike {
  prepare(sql: string): MarketingD1StatementLike;
}

interface MarketingRenderRunRow {
  request_id: string;
  tenant_id: string;
  adapter_id: string;
  adapter_catalog_digest: string;
  idempotency_key: string;
  actor_id: string;
  budget_reservation_id: string;
  expires_at: string;
  input_digest: string;
  action_digest: string;
  request_digest: string;
  prepared_json: string;
  status: 'prepared' | 'claimed' | 'invoking' | 'succeeded' | 'failed' | 'indeterminate';
  approval_decision_id: string | null;
  claim_id: string | null;
  fencing_token: number;
  attempt: number;
  claimed_at: string | null;
  lease_expires_at: string | null;
  invoked_at: string | null;
  artifact_json: string | null;
  receipt_json: string | null;
  artifact_digest: string | null;
  provider_usage_tokens: number | null;
  error_code: string | null;
  created_at: string;
  updated_at: string;
  terminal_at: string | null;
}

interface MarketingApprovalRow {
  approval_decision_id: string;
  approval_json: string;
}

const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const APPROVAL_ID_RE = /^[a-z0-9][a-z0-9._:@-]{2,127}$/;

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as T : null;
  } catch {
    return null;
  }
}

function changes(result: { meta?: { changes?: number } }): number {
  return Number(result.meta?.changes ?? 0);
}

async function readRun(db: MarketingD1DatabaseLike, requestId: string): Promise<MarketingRenderRunRow | null> {
  return db.prepare(`
    SELECT *
    FROM marketing_render_runs
    WHERE request_id = ? AND tenant_id = ?
  `).bind(requestId, MARKETING_CREATE_TENANT_ID).first<MarketingRenderRunRow>();
}

async function readRunByIdempotency(
  db: MarketingD1DatabaseLike,
  idempotencyKey: string,
): Promise<MarketingRenderRunRow | null> {
  return db.prepare(`
    SELECT *
    FROM marketing_render_runs
    WHERE tenant_id = ? AND idempotency_key = ?
  `).bind(MARKETING_CREATE_TENANT_ID, idempotencyKey).first<MarketingRenderRunRow>();
}

function preparedFromRow(row: MarketingRenderRunRow | null): MarketingPreparedRender | null {
  if (!row || row.tenant_id !== MARKETING_CREATE_TENANT_ID || row.adapter_id !== MARKETING_CREATE_ADAPTER_ID) return null;
  const prepared = parseJson<MarketingPreparedRender>(row.prepared_json);
  if (!prepared
      || prepared.requestId !== row.request_id
      || prepared.requestDigest !== row.request_digest
      || prepared.actionDigest !== row.action_digest
      || prepared.inputDigest !== row.input_digest
      || prepared.adapterCatalogDigest !== row.adapter_catalog_digest) return null;
  return prepared;
}

function terminalClaim(row: MarketingRenderRunRow): MarketingRenderClaimResult {
  if (row.status === 'succeeded') {
    const artifact = parseJson<MarketingAssetDraft>(row.artifact_json);
    const receipt = parseJson<MarketingOperatorReceipt>(row.receipt_json);
    if (!artifact || !receipt || artifact.content_digest !== row.artifact_digest) {
      return { status: 'reconciliation_required', state: 'indeterminate' };
    }
    return { status: 'terminal', outcome: 'succeeded', artifact, receipt };
  }
  if (row.status === 'failed') return { status: 'terminal', outcome: 'failed', code: row.error_code ?? 'renderer_failed' };
  if (row.status === 'invoking' || row.status === 'indeterminate') {
    return { status: 'reconciliation_required', state: row.status };
  }
  return { status: 'conflict', code: 'render_state_invalid' };
}

function claimedResult(row: MarketingRenderRunRow): MarketingRenderClaimResult {
  if (!row.claim_id || !row.lease_expires_at || row.fencing_token < 1) {
    return { status: 'conflict', code: 'claim_state_invalid' };
  }
  return {
    status: 'claimed',
    requestId: row.request_id,
    claimId: row.claim_id,
    fencingToken: row.fencing_token,
    leaseExpiresAt: row.lease_expires_at,
  };
}

export function d1MarketingRenderStore(db: MarketingD1DatabaseLike): MarketingRenderStoreLike {
  return {
    async prepare(record) {
      let inserted;
      try {
        inserted = await db.prepare(`
          INSERT OR IGNORE INTO marketing_render_runs (
            request_id, tenant_id, adapter_id, adapter_catalog_digest,
            idempotency_key, actor_id, budget_reservation_id, expires_at,
            input_digest, action_digest, request_digest, prepared_json,
            status, fencing_token, attempt, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'prepared', 0, 1, ?, ?)
        `).bind(
          record.requestId,
          MARKETING_CREATE_TENANT_ID,
          MARKETING_CREATE_ADAPTER_ID,
          record.adapterCatalogDigest,
          record.idempotencyKey,
          record.actorId,
          record.budgetReservationId,
          record.expiresAt,
          record.inputDigest,
          record.actionDigest,
          record.requestDigest,
          JSON.stringify(record),
          record.preparedAt,
          record.preparedAt,
        ).run();
      } catch {
        return { status: 'conflict' as const };
      }
      if (changes(inserted) === 1) return { status: 'prepared' as const, record };
      const existing = await readRunByIdempotency(db, record.idempotencyKey);
      const existingPrepared = preparedFromRow(existing);
      if (!existing || !existingPrepared
          || existing.request_id !== record.requestId
          || existing.request_digest !== record.requestDigest
          || existing.action_digest !== record.actionDigest) {
        return { status: 'conflict' as const };
      }
      return { status: 'duplicate' as const, record: existingPrepared };
    },

    async getPrepared(requestId) {
      return preparedFromRow(await readRun(db, requestId));
    },

    async approvePrepared(input) {
      if (!/^\d{1,32}$/.test(input.founderId)
          || !APPROVAL_ID_RE.test(input.approvalDecisionId)
          || !ISO_TIMESTAMP_RE.test(input.decidedAt)) return { status: 'conflict' as const };
      const row = await readRun(db, input.requestId);
      const prepared = preparedFromRow(row);
      if (!row || !prepared) return { status: 'not_found' as const };
      const decidedMs = Date.parse(input.decidedAt);
      const preparedMs = Date.parse(prepared.preparedAt);
      const expiresMs = Date.parse(prepared.expiresAt);
      if (row.status !== 'prepared'
          || !Number.isFinite(decidedMs)
          || !Number.isFinite(preparedMs)
          || !Number.isFinite(expiresMs)
          || decidedMs < preparedMs
          || decidedMs >= expiresMs) {
        return { status: 'conflict' as const };
      }
      const approverId = `telegram-founder-${input.founderId}`;
      const approval: MarketingApprovalDecision = {
        schema_version: 'approval_decision@1.0.0',
        tenant: {
          tenant_id: MARKETING_CREATE_TENANT_ID,
          purpose: 'marketing_create_render',
          data_classification: 'public_business',
          processing_region: 'global',
          retention_days: 30,
        },
        record_id: input.approvalDecisionId,
        action_request_id: prepared.requestId,
        action_digest: prepared.actionDigest,
        approver_id: approverId,
        scope: 'exact_action',
        decision: 'approved',
        decided_at: input.decidedAt,
        expires_at: prepared.expiresAt,
      };
      let insertResult;
      try {
        insertResult = await db.prepare(`
          INSERT OR IGNORE INTO marketing_render_approvals (
            approval_decision_id, request_id, tenant_id, action_digest,
            approver_id, decision, decided_at, expires_at, approval_json
          ) VALUES (?, ?, ?, ?, ?, 'approved', ?, ?, ?)
        `).bind(
          approval.record_id,
          prepared.requestId,
          MARKETING_CREATE_TENANT_ID,
          prepared.actionDigest,
          approverId,
          input.decidedAt,
          prepared.expiresAt,
          JSON.stringify(approval),
        ).run();
      } catch {
        return { status: 'conflict' as const };
      }
      const approvalRow = changes(insertResult) === 1
        ? { approval_decision_id: approval.record_id, approval_json: JSON.stringify(approval) }
        : await db.prepare(`
            SELECT approval_decision_id, approval_json
            FROM marketing_render_approvals
            WHERE request_id = ? AND tenant_id = ? AND action_digest = ? AND approver_id = ?
          `).bind(
            prepared.requestId,
            MARKETING_CREATE_TENANT_ID,
            prepared.actionDigest,
            approverId,
          ).first<MarketingApprovalRow>();
      const persisted = approvalRow ? parseJson<MarketingApprovalDecision>(approvalRow.approval_json) : null;
      if (!persisted) return { status: 'conflict' as const };
      const bound = await db.prepare(`
        UPDATE marketing_render_runs
        SET approval_decision_id = ?, updated_at = ?
        WHERE request_id = ? AND tenant_id = ? AND status = 'prepared'
          AND action_digest = ?
          AND (approval_decision_id IS NULL OR approval_decision_id = ?)
      `).bind(
        persisted.record_id,
        input.decidedAt,
        prepared.requestId,
        MARKETING_CREATE_TENANT_ID,
        prepared.actionDigest,
        persisted.record_id,
      ).run();
      if (changes(bound) !== 1) return { status: 'conflict' as const };
      return {
        status: changes(insertResult) === 1 ? 'approved' as const : 'duplicate' as const,
        approval: persisted,
      };
    },

    async getApproval(approvalDecisionId) {
      const row = await db.prepare(`
        SELECT approval_decision_id, approval_json
        FROM marketing_render_approvals
        WHERE approval_decision_id = ? AND tenant_id = ?
      `).bind(approvalDecisionId, MARKETING_CREATE_TENANT_ID).first<MarketingApprovalRow>();
      const approval = row ? parseJson<MarketingApprovalDecision>(row.approval_json) : null;
      return approval && approval.record_id === approvalDecisionId ? approval : null;
    },

    async claim(input: MarketingRenderClaimInput) {
      const initial = await readRun(db, input.requestId);
      if (!initial) return { status: 'conflict', code: 'render_request_not_found' };
      if (initial.request_digest !== input.requestDigest
          || initial.action_digest !== input.actionDigest
          || initial.approval_decision_id !== input.approvalDecisionId) {
        return { status: 'conflict', code: 'render_identity_conflict' };
      }
      if (['succeeded', 'failed', 'invoking', 'indeterminate'].includes(initial.status)) return terminalClaim(initial);
      if (initial.status === 'claimed') {
        const leaseMs = Date.parse(initial.lease_expires_at ?? '');
        const claimMs = Date.parse(input.claimedAt);
        if (!Number.isFinite(leaseMs) || !Number.isFinite(claimMs)) {
          return { status: 'conflict', code: 'claim_time_invalid' };
        }
        if (leaseMs > claimMs) return { status: 'busy', retryAfterMs: leaseMs - claimMs };
        let takeover;
        try {
          takeover = await db.prepare(`
            UPDATE marketing_render_runs
            SET claim_id = ?, fencing_token = fencing_token + 1,
              claimed_at = ?, lease_expires_at = ?, updated_at = ?
            WHERE request_id = ? AND tenant_id = ? AND status = 'claimed'
              AND request_digest = ? AND action_digest = ?
              AND approval_decision_id = ? AND fencing_token = ?
              AND lease_expires_at <= ?
          `).bind(
            input.claimId,
            input.claimedAt,
            input.leaseExpiresAt,
            input.claimedAt,
            input.requestId,
            MARKETING_CREATE_TENANT_ID,
            input.requestDigest,
            input.actionDigest,
            input.approvalDecisionId,
            initial.fencing_token,
            input.claimedAt,
          ).run();
        } catch {
          return { status: 'reconciliation_required', state: 'indeterminate' };
        }
        if (changes(takeover) !== 1) {
          const raced = await readRun(db, input.requestId);
          return raced && ['succeeded', 'failed', 'invoking', 'indeterminate'].includes(raced.status)
            ? terminalClaim(raced)
            : { status: 'busy', retryAfterMs: Math.max(0, Date.parse(raced?.lease_expires_at ?? input.claimedAt) - claimMs) };
        }
        const reclaimed = await readRun(db, input.requestId);
        return reclaimed
          && reclaimed.status === 'claimed'
          && reclaimed.claim_id === input.claimId
          && reclaimed.fencing_token === initial.fencing_token + 1
          ? claimedResult(reclaimed)
          : { status: 'reconciliation_required', state: 'indeterminate' };
      }
      let claimed;
      try {
        claimed = await db.prepare(`
          UPDATE marketing_render_runs
          SET status = 'claimed', claim_id = ?, fencing_token = 1,
            claimed_at = ?, lease_expires_at = ?, updated_at = ?
          WHERE request_id = ? AND tenant_id = ? AND status = 'prepared'
            AND request_digest = ? AND action_digest = ?
            AND approval_decision_id = ? AND fencing_token = 0
        `).bind(
          input.claimId,
          input.claimedAt,
          input.leaseExpiresAt,
          input.claimedAt,
          input.requestId,
          MARKETING_CREATE_TENANT_ID,
          input.requestDigest,
          input.actionDigest,
          input.approvalDecisionId,
        ).run();
      } catch {
        return { status: 'reconciliation_required', state: 'indeterminate' };
      }
      if (changes(claimed) !== 1) {
        const raced = await readRun(db, input.requestId);
        if (!raced) return { status: 'conflict', code: 'render_request_not_found' };
        if (['succeeded', 'failed', 'invoking', 'indeterminate'].includes(raced.status)) return terminalClaim(raced);
        return { status: 'busy', retryAfterMs: Math.max(0, Date.parse(raced.lease_expires_at ?? input.claimedAt) - Date.parse(input.claimedAt)) };
      }
      const stored = await readRun(db, input.requestId);
      return stored
        && stored.status === 'claimed'
        && stored.claim_id === input.claimId
        && stored.fencing_token === 1
        ? claimedResult(stored)
        : { status: 'reconciliation_required', state: 'indeterminate' };
    },

    async beginInvocation(input) {
      let result;
      try {
        result = await db.prepare(`
          UPDATE marketing_render_runs
          SET status = 'invoking', invoked_at = ?, updated_at = ?
          WHERE request_id = ? AND tenant_id = ? AND status = 'claimed'
            AND claim_id = ? AND fencing_token = ? AND attempt = 1
        `).bind(
          input.observedAt,
          input.observedAt,
          input.requestId,
          MARKETING_CREATE_TENANT_ID,
          input.claimId,
          input.fencingToken,
        ).run();
      } catch {
        return 'reconciliation_required';
      }
      if (changes(result) !== 1) return 'reconciliation_required';
      const readback = await readRun(db, input.requestId);
      return readback?.status === 'invoking'
        && readback.claim_id === input.claimId
        && readback.fencing_token === input.fencingToken
        && readback.invoked_at === input.observedAt
        ? 'confirmed'
        : 'reconciliation_required';
    },

    async complete(input) {
      let result;
      try {
        result = await db.prepare(`
          UPDATE marketing_render_runs
          SET status = 'succeeded', artifact_json = ?, receipt_json = ?,
            artifact_digest = ?, provider_usage_tokens = ?, error_code = NULL,
            updated_at = ?, terminal_at = ?
          WHERE request_id = ? AND tenant_id = ? AND status = 'invoking'
            AND claim_id = ? AND fencing_token = ? AND attempt = 1
        `).bind(
          JSON.stringify(input.artifact),
          JSON.stringify(input.receipt),
          input.artifactDigest,
          input.providerUsageTokens,
          input.recordedAt,
          input.recordedAt,
          input.requestId,
          MARKETING_CREATE_TENANT_ID,
          input.claimId,
          input.fencingToken,
        ).run();
      } catch {
        return 'reconciliation_required';
      }
      if (changes(result) !== 1) return 'reconciliation_required';
      const readback = await readRun(db, input.requestId);
      return readback?.status === 'succeeded'
        && readback.claim_id === input.claimId
        && readback.fencing_token === input.fencingToken
        && readback.artifact_digest === input.artifactDigest
        ? 'recorded'
        : 'reconciliation_required';
    },

    async fail(input) {
      const errorCode = /^[a-z][a-z0-9_]{0,63}$/.test(input.errorCode) ? input.errorCode : 'renderer_failed';
      try {
        const result = await db.prepare(`
          UPDATE marketing_render_runs
          SET status = 'failed', error_code = ?, updated_at = ?, terminal_at = ?
          WHERE request_id = ? AND tenant_id = ? AND status = 'invoking'
            AND claim_id = ? AND fencing_token = ? AND attempt = 1
        `).bind(
          errorCode,
          input.recordedAt,
          input.recordedAt,
          input.requestId,
          MARKETING_CREATE_TENANT_ID,
          input.claimId,
          input.fencingToken,
        ).run();
        return changes(result) === 1 ? 'recorded' : 'reconciliation_required';
      } catch {
        return 'reconciliation_required';
      }
    },

    async markIndeterminate(input) {
      const errorCode = /^[a-z][a-z0-9_]{0,63}$/.test(input.errorCode) ? input.errorCode : 'provider_outcome_indeterminate';
      try {
        const result = await db.prepare(`
          UPDATE marketing_render_runs
          SET status = 'indeterminate', error_code = ?, updated_at = ?, terminal_at = ?
          WHERE request_id = ? AND tenant_id = ? AND status = 'invoking'
            AND claim_id = ? AND fencing_token = ? AND attempt = 1
        `).bind(
          errorCode,
          input.recordedAt,
          input.recordedAt,
          input.requestId,
          MARKETING_CREATE_TENANT_ID,
          input.claimId,
          input.fencingToken,
        ).run();
        return changes(result) === 1 ? 'recorded' : 'reconciliation_required';
      } catch {
        return 'reconciliation_required';
      }
    },
  };
}

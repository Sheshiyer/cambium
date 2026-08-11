// cambium-quests · Workers runtime glue. All logic lives in handler.ts (pure, node:test-covered).

import { handle, TELEGRAM_PROD_PUBKEY } from './handler.ts';
import {
  createProviderEmbedder,
  createSemanticRecall,
} from './context-bindings.ts';
import { createGithubRoutineContext, parseGithubKnowledgeAllowlistJson } from './github-knowledge.ts';
import { createPortfolioAdminActionQueue, createPortfolioAdminActionStore } from './portfolio-admin-actions.ts';
import { createGithubCommandExecutor, parseAllowedRepos } from './github-command.ts';
import { createIVerifExpleeObserver } from './iverif-explee.ts';
import { d1LeadRuntimeStore } from './lead-runtime-store.ts';
import { d1MarketingRenderStore } from './marketing-render-store.ts';
import { d1GoalGraphStore } from './goal-graph-store.ts';
import { d1BranchMapReceiptStore } from './branch-map-receipt-store.ts';
import type {
  BridgeAssignmentRecord,
  BridgeBusinessArtifactReceipt,
  BridgeBusinessArtifactUpload,
  BridgeBusinessTaskRecord,
  BridgeBusinessTaskStoreLike,
  BridgeExecutionClaimInput,
  BridgeExecutionClaimResult,
  BridgeExecutionContractIdentity,
  BridgeExecutionOutcomeInput,
  BridgeExecutionOutcomeResult,
  BridgeExecutionStoreLike,
  BridgeRoleTaskClaimRecord,
  BridgeStoreLike,
  FabricEvidenceCandidateRecord,
  FabricEvidenceReviewRecord,
  FabricLedgerEventRecord,
  FabricLedgerStoreLike,
  FabricLedgerTaskRecord,
  ProviderConfig,
  SimpleRequest,
} from './handler.ts';
import type { ContextRouteDeps } from './context-routes.ts';
import type { R2BucketLike, VectorizeIndexLike } from './context-bindings.ts';

export interface D1StatementLike {
  bind(...values: unknown[]): D1StatementLike;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results?: T[] }>;
  run(): Promise<{ meta?: { changes?: number } }>;
}

export interface D1DatabaseLike {
  prepare(sql: string): D1StatementLike;
}

interface Env {
  /** App-state KV (quests, bridge idempotency, etc.) */
  QUESTS: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
    list(opts: { prefix: string }): Promise<{ keys: Array<{ name: string }> }>;
  };
  /**
   * Provider/API secrets KV (Labs `cambium-secrets`).
   * OPENCODE_API_KEY / EXPLEE_API_KEY live here; Worker secrets remain fallback.
   */
  SECRETS?: {
    get(key: string): Promise<string | null>;
  };
  BRIDGE_DB?: D1DatabaseLike;
  THOUGHTSEED_VAULT?: R2BucketLike;
  CAMBIUM_CORTEX?: VectorizeIndexLike;
  QUESTS_PUSH_TOKEN?: string;
  GATE_BOT_ID?: string;
  GATE_FOUNDER_IDS?: string;
  GATE_TG_PUBKEY?: string;
  BRIDGE_TOKEN?: string;
  HERMES_ASSIGNMENT_TOKEN?: string;
  IVERIF_READ_TOKEN?: string;
  EXPLEE_API_KEY?: string;
  HERMES_ROLE_TASK_BINDINGS_JSON?: string;
  HANDOFF_SECRET?: string;
  PROVIDER_BROKER_TOKEN?: string;
  CONTEXT_ROUTE_TOKEN?: string;
  CONTEXT_ALLOWED_TENANTS?: string;
  CONTEXT_EMBEDDING_PROVIDER?: string;
  CONTEXT_EMBEDDING_MODEL?: string;
  GITHUB_KNOWLEDGE_TOKEN?: string;
  GITHUB_KNOWLEDGE_REPOSITORY?: string;
  GITHUB_KNOWLEDGE_REF?: string;
  GITHUB_KNOWLEDGE_ROUTINE_ALLOWLIST_JSON?: string;
  GITHUB_AGENT_TOKEN?: string;
  GITHUB_AGENT_ALLOWED_REPOS?: string;
  OLLAMA_API_KEY?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_DEFAULT_MODEL?: string;
  NVIDIA_API_KEY?: string;
  NVIDIA_BASE_URL?: string;
  NVIDIA_DEFAULT_MODEL?: string;
  MARKETING_CREATE_ACTIVATION?: string;
  NVIDIA_MARKETING_CREATE_API_KEY?: string;
  NEBIUS_API_KEY?: string;
  NEBIUS_BASE_URL?: string;
  NEBIUS_DEFAULT_MODEL?: string;
  KIMI_CODING_API_KEY?: string;
  KIMI_CODING_BASE_URL?: string;
  KIMI_CODING_DEFAULT_MODEL?: string;
  COMMAND_CODE_API_KEY?: string;
  COMMAND_CODE_BASE_URL?: string;
  COMMAND_CODE_DEFAULT_MODEL?: string;
  COMMAND_CODE_EGRESS_TOKEN?: string;
  OPENCODE_API_KEY?: string;
  OPENCODE_BASE_URL?: string;
  OPENCODE_DEFAULT_MODEL?: string;
  GATE_BRANCH_MAP_TENANTS?: string;
  MISSION_FABRIC_TENANTS?: string;
  MISSION_FABRIC_VIEWER_IDS?: string;
  TF_ACCESS_TEAM_DOMAIN?: string;
  TF_ACCESS_AUD?: string;
  PLEXUS_WHOAMI_URL?: string;
}

function parseJsonRecord(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseAllowedTenants(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((tenant) => tenant.trim())
    .filter((tenant) => /^[a-z0-9][a-z0-9_-]{1,79}$/.test(tenant));
}

function parseAllowedUserIds(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter((id) => /^[0-9]{1,32}$/.test(id));
}

export function d1BridgeStore(db: D1DatabaseLike): BridgeStoreLike {
  return {
    async putUpstream(tenantId, id, message) {
      const receivedAt = typeof message.receivedAt === 'string' ? message.receivedAt : new Date().toISOString();
      await db.prepare(`
        INSERT OR REPLACE INTO bridge_up (tenant_id, id, message_json, received_at)
        VALUES (?, ?, ?, ?)
      `).bind(tenantId, id, JSON.stringify(message), receivedAt).run();
    },
    async listUpstream(tenantId, limit) {
      const rows = (await db.prepare(`
        SELECT message_json
        FROM bridge_up
        WHERE tenant_id = ?
        ORDER BY received_at DESC
        LIMIT ?
      `).bind(tenantId, limit).all<{ message_json: string }>()).results ?? [];
      const messages: any[] = [];
      for (const row of rows.reverse()) {
        try { messages.push(JSON.parse(row.message_json)); } catch { /* skip corrupt D1 inbox records */ }
      }
      return messages;
    },
    async getDirective(memberId, id) {
      const row = await db.prepare(`
        SELECT directive_json, delivered, delivered_at
        FROM bridge_directives
        WHERE member_id = ? AND id = ?
      `).bind(memberId, id).first<{
        directive_json: string;
        delivered: number;
        delivered_at: string | null;
      }>();
      if (!row) return null;
      let directive: Record<string, unknown>;
      try { directive = parseJsonRecord(row.directive_json); } catch { return null; }
      return {
        ...directive,
        delivered: row.delivered === 1,
        ...(row.delivered_at ? { deliveredAt: row.delivered_at } : {}),
      };
    },
    async putDirective(memberId, id, directive) {
      const enqueuedAt = typeof directive.enqueuedAt === 'string' ? directive.enqueuedAt : new Date().toISOString();
      await db.prepare(`
        INSERT INTO bridge_directives (member_id, id, directive_json, delivered, enqueued_at, delivered_at)
        VALUES (?, ?, ?, 0, ?, NULL)
        ON CONFLICT(member_id, id) DO UPDATE SET
          directive_json = excluded.directive_json,
          delivered = 0,
          enqueued_at = excluded.enqueued_at,
          delivered_at = NULL
        WHERE CASE WHEN json_valid(bridge_directives.directive_json)
            THEN COALESCE(json_extract(bridge_directives.directive_json, '$.payload.type'), '')
            ELSE ''
          END <> 'native_execution'
          AND CASE WHEN json_valid(excluded.directive_json)
            THEN COALESCE(json_extract(excluded.directive_json, '$.payload.type'), '')
            ELSE ''
          END <> 'native_execution'
      `).bind(memberId, id, JSON.stringify(directive), enqueuedAt).run();
    },
    async putDirectiveIfAbsent(memberId, id, directive) {
      const enqueuedAt = typeof directive.enqueuedAt === 'string' ? directive.enqueuedAt : new Date().toISOString();
      await db.prepare(`
        INSERT OR IGNORE INTO bridge_directives (member_id, id, directive_json, delivered, enqueued_at, delivered_at)
        VALUES (?, ?, ?, 0, ?, NULL)
      `).bind(memberId, id, JSON.stringify(directive), enqueuedAt).run();
    },
    async listPendingDirectives(memberId, limit) {
      const scanLimit = Math.max(limit * 4, limit + 25);
      const rows = (await db.prepare(`
        SELECT directive_json
        FROM bridge_directives
        WHERE member_id = ? AND delivered = 0
        ORDER BY enqueued_at ASC
        LIMIT ?
      `).bind(memberId, scanLimit).all<{ directive_json: string }>()).results ?? [];
      const directives: any[] = [];
      let skipped = 0;
      for (const row of rows) {
        if (directives.length >= limit) break;
        try { directives.push(JSON.parse(row.directive_json)); } catch { skipped++; }
      }
      return { directives, skipped };
    },
    async markDirectiveDelivered(memberId, id, deliveredAt) {
      const row = await db.prepare(`
        SELECT directive_json
        FROM bridge_directives
        WHERE member_id = ? AND id = ? AND delivered = 0
      `).bind(memberId, id).first<{ directive_json: string }>();
      if (!row) return false;
      let directive: Record<string, unknown>;
      try { directive = parseJsonRecord(row.directive_json); } catch { directive = { id, memberId }; }
      directive.delivered = true;
      directive.deliveredAt = deliveredAt;
      const result = await db.prepare(`
        UPDATE bridge_directives
        SET delivered = 1, delivered_at = ?, directive_json = ?
        WHERE member_id = ? AND id = ? AND delivered = 0
      `).bind(deliveredAt, JSON.stringify(directive), memberId, id).run();
      return (result.meta?.changes ?? 0) > 0;
    },
    async getAssignment(memberId, eventId) {
      const row = await db.prepare(`
        SELECT directive_id, task_id, project_id, correlation_id, payload_hash, enqueued_at
        FROM bridge_assignments
        WHERE member_id = ? AND event_id = ?
      `).bind(memberId, eventId).first<{
        directive_id: string;
        task_id: string;
        project_id: string;
        correlation_id: string | null;
        payload_hash: string;
        enqueued_at: string;
      }>();
      if (!row) return null;
      return {
        id: row.directive_id,
        memberId,
        taskId: row.task_id,
        projectId: row.project_id,
        eventId,
        correlationId: row.correlation_id ?? undefined,
        payloadHash: row.payload_hash,
        enqueuedAt: row.enqueued_at,
      };
    },
    async putAssignment(record: BridgeAssignmentRecord) {
      await db.prepare(`
        INSERT OR IGNORE INTO bridge_assignments (
          member_id, event_id, directive_id, task_id, project_id, correlation_id, payload_hash, enqueued_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        record.memberId,
        record.eventId,
        record.id,
        record.taskId,
        record.projectId,
        record.correlationId ?? null,
        record.payloadHash,
        record.enqueuedAt,
      ).run();
    },
    async getRoleTaskClaim(eventId) {
      const row = await db.prepare(`
        SELECT role_id, member_id, project_id, binding_version, intent_hash, claimed_at
        FROM bridge_role_task_claims
        WHERE event_id = ?
      `).bind(eventId).first<{
        role_id: string;
        member_id: string;
        project_id: string;
        binding_version: string;
        intent_hash: string;
        claimed_at: string;
      }>();
      if (!row) return null;
      return {
        eventId,
        roleId: row.role_id,
        memberId: row.member_id,
        projectId: row.project_id,
        bindingVersion: row.binding_version,
        intentHash: row.intent_hash,
        claimedAt: row.claimed_at,
      };
    },
    async putRoleTaskClaim(record: BridgeRoleTaskClaimRecord) {
      await db.prepare(`
        INSERT OR IGNORE INTO bridge_role_task_claims (
          event_id, role_id, member_id, project_id, binding_version, intent_hash, claimed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        record.eventId,
        record.roleId,
        record.memberId,
        record.projectId,
        record.bindingVersion,
        record.intentHash,
        record.claimedAt,
      ).run();
    },
  };
}

interface BridgeExecutionRow {
  member_id: string;
  directive_id: string;
  idempotency_key: string;
  input_digest: string;
  execution_id: string;
  claim_id: string;
  fencing_token: string;
  lease_expires_at: string;
  runner_id: string;
  host_identity: string;
  attempt: number;
  outcome_status: 'executed' | 'failed' | 'retryable' | null;
  terminal: number;
  attestation_json: string | null;
  attestation_id: string | null;
  attestation_digest: string | null;
  claimed_at: string;
  outcome_recorded_at: string | null;
  acknowledged_at: string | null;
}

interface BridgeExecutionIdentityRow {
  execution_id: string;
  member_id: string;
  directive_id: string;
  idempotency_key: string;
  input_digest: string;
  runner_id: string;
  host_identity: string;
}

async function executionRow(db: D1DatabaseLike, memberId: string, directiveId: string): Promise<BridgeExecutionRow | null> {
  return db.prepare(`
    SELECT member_id, directive_id, idempotency_key, input_digest, execution_id, claim_id, fencing_token,
      lease_expires_at, runner_id, host_identity, attempt, outcome_status, terminal, attestation_json,
      attestation_id, attestation_digest, claimed_at, outcome_recorded_at, acknowledged_at
    FROM bridge_executions
    WHERE member_id = ? AND directive_id = ?
  `).bind(memberId, directiveId).first<BridgeExecutionRow>();
}

async function executionIdentityRow(db: D1DatabaseLike, executionId: string): Promise<BridgeExecutionIdentityRow | null> {
  return db.prepare(`
    SELECT execution_id, member_id, directive_id, idempotency_key, input_digest, runner_id, host_identity
    FROM bridge_execution_identities
    WHERE execution_id = ?
  `).bind(executionId).first<BridgeExecutionIdentityRow>();
}

function executionIdentityMatches(row: BridgeExecutionIdentityRow, input: BridgeExecutionClaimInput): boolean {
  if (row.member_id !== input.memberId
    || row.directive_id !== input.directiveId
    || row.idempotency_key !== input.idempotencyKey
    || row.input_digest !== input.inputDigest
    || row.runner_id !== input.runnerId
    || row.host_identity !== input.hostIdentity) return false;
  return true;
}

function executionContractMatches(
  row: BridgeExecutionRow,
  input: BridgeExecutionContractIdentity,
): boolean {
  return row.idempotency_key === input.idempotencyKey
    && row.input_digest === input.inputDigest
    && row.execution_id === input.executionId;
}

function activeClaimBusy(row: BridgeExecutionRow, claimedAt: string): BridgeExecutionClaimResult {
  const remaining = Date.parse(row.lease_expires_at) - Date.parse(claimedAt);
  return {
    status: 'busy',
    retryAfterMs: Math.max(1, Math.min(30_000, Number.isFinite(remaining) ? remaining : 30_000)),
  };
}

function terminalClaimResult(row: BridgeExecutionRow): BridgeExecutionClaimResult {
  const attestation = parseJsonRecord(row.attestation_json);
  const command = attestation.command === 'canary.record' || attestation.command === 'service_agreement.draft.render'
    ? attestation.command
    : null;
  if ((row.outcome_status !== 'executed' && row.outcome_status !== 'failed')
    || attestation.schema !== 'thoughtseed.hermes.execution_attestation.v1'
    || typeof attestation.id !== 'string'
    || typeof attestation.executionId !== 'string'
    || typeof attestation.directiveId !== 'string'
    || typeof attestation.idempotencyKey !== 'string'
    || typeof attestation.runnerId !== 'string'
    || typeof attestation.hostIdentity !== 'string'
    || !command
    || attestation.status !== row.outcome_status
    || attestation.executionId !== row.execution_id
    || attestation.directiveId !== row.directive_id
    || attestation.idempotencyKey !== row.idempotency_key
    || attestation.inputDigest !== row.input_digest
    || attestation.runnerId !== row.runner_id
    || attestation.hostIdentity !== row.host_identity
    || typeof attestation.startedAt !== 'string'
    || typeof attestation.finishedAt !== 'string'
    || (row.outcome_status === 'executed' && (attestation.exitCode !== 0 || typeof attestation.outputDigest !== 'string'))
    || (row.outcome_status === 'failed' && (attestation.exitCode !== 1 || typeof attestation.errorCode !== 'string'))) {
    throw new Error('terminal execution row is missing its redacted attestation');
  }
  const storedAttestation = {
    schema: 'thoughtseed.hermes.execution_attestation.v1' as const,
    id: attestation.id,
    executionId: attestation.executionId,
    directiveId: attestation.directiveId,
    idempotencyKey: attestation.idempotencyKey,
    runnerId: attestation.runnerId,
    hostIdentity: attestation.hostIdentity,
    command,
    status: row.outcome_status,
    exitCode: attestation.exitCode as 0 | 1,
    inputDigest: attestation.inputDigest,
    ...(typeof attestation.outputDigest === 'string' ? { outputDigest: attestation.outputDigest } : {}),
    ...(command === 'service_agreement.draft.render' && attestation.businessReceipt && typeof attestation.businessReceipt === 'object'
      ? { businessReceipt: attestation.businessReceipt as BridgeBusinessArtifactReceipt }
      : {}),
    ...(typeof attestation.errorCode === 'string' ? { errorCode: attestation.errorCode } : {}),
    startedAt: attestation.startedAt,
    finishedAt: attestation.finishedAt,
  };
  return {
    status: 'terminal',
    claimId: row.claim_id,
    fencingToken: row.fencing_token,
    attempt: row.attempt,
    runnerId: row.runner_id,
    hostIdentity: row.host_identity,
    outcome: {
      status: row.outcome_status,
      attestation: storedAttestation,
    },
  };
}

async function insertOutcomeEvent(db: D1DatabaseLike, input: BridgeExecutionOutcomeInput): Promise<void> {
  const event = {
    status: input.status,
    attestation: input.attestation,
  };
  await db.prepare(`
    INSERT OR IGNORE INTO bridge_execution_events (
      execution_id, attestation_id, member_id, directive_id, status,
      attestation_digest, event_json, recorded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    input.executionId,
    input.attestation.id,
    input.memberId,
    input.directiveId,
    input.status,
    input.attestationDigest,
    JSON.stringify(event),
    input.recordedAt,
  ).run();
}

function identicalOutcome(row: BridgeExecutionRow, input: BridgeExecutionOutcomeInput): boolean {
  return row.outcome_status === input.status
    && row.attestation_id === input.attestation.id
    && row.attestation_digest === input.attestationDigest;
}

export function d1BridgeExecutionStore(db: D1DatabaseLike): BridgeExecutionStoreLike {
  return {
    async claimExecution(input: BridgeExecutionClaimInput): Promise<BridgeExecutionClaimResult> {
      const current = await executionRow(db, input.memberId, input.directiveId);
      if (current?.terminal === 1) {
        return executionContractMatches(current, input)
          ? terminalClaimResult(current)
          : { status: 'conflict', reason: 'execution_replay_mismatch' };
      }
      if (current
        && executionContractMatches(current, input)
        && (current.runner_id !== input.runnerId || current.host_identity !== input.hostIdentity)
        && current.lease_expires_at > input.claimedAt) {
        return activeClaimBusy(current, input.claimedAt);
      }
      const identity = await executionIdentityRow(db, input.executionId);
      if (identity && !executionIdentityMatches(identity, input)) {
        return { status: 'conflict', reason: 'execution_replay_mismatch' };
      }
      try {
        await db.prepare(`
          INSERT INTO bridge_executions (
            member_id, directive_id, idempotency_key, input_digest, execution_id, claim_id,
            fencing_token, lease_expires_at, runner_id, host_identity, attempt, claimed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
          ON CONFLICT(member_id, directive_id) DO UPDATE SET
            idempotency_key = excluded.idempotency_key,
            input_digest = excluded.input_digest,
            execution_id = excluded.execution_id,
            claim_id = excluded.claim_id,
            fencing_token = excluded.fencing_token,
            lease_expires_at = excluded.lease_expires_at,
            runner_id = excluded.runner_id,
            host_identity = excluded.host_identity,
            attempt = bridge_executions.attempt + 1,
            outcome_status = NULL,
            terminal = 0,
            attestation_json = NULL,
            attestation_id = NULL,
            attestation_digest = NULL,
            claimed_at = excluded.claimed_at,
            outcome_recorded_at = NULL,
            acknowledged_at = NULL
          WHERE bridge_executions.terminal = 0
            AND bridge_executions.lease_expires_at <= excluded.claimed_at
        `).bind(
          input.memberId,
          input.directiveId,
          input.idempotencyKey,
          input.inputDigest,
          input.executionId,
          input.claimId,
          input.fencingToken,
          input.leaseExpiresAt,
          input.runnerId,
          input.hostIdentity,
          input.claimedAt,
        ).run();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/execution identity conflict|unique constraint failed|sqlite_constraint_(?:unique|primarykey)/i.test(message)) {
          const raced = await executionIdentityRow(db, input.executionId);
          return raced && !executionIdentityMatches(raced, input)
            ? { status: 'conflict', reason: 'execution_replay_mismatch' }
            : { status: 'conflict', reason: 'execution_id_reused' };
        }
        throw error;
      }

      const row = await executionRow(db, input.memberId, input.directiveId);
      if (!row) return { status: 'conflict', reason: 'execution_id_reused' };
      if (row.terminal === 1) {
        return executionContractMatches(row, input)
          ? terminalClaimResult(row)
          : { status: 'conflict', reason: 'execution_replay_mismatch' };
      }
      if (row.execution_id === input.executionId) {
        if (row.idempotency_key !== input.idempotencyKey
          || row.input_digest !== input.inputDigest
          || row.runner_id !== input.runnerId
          || row.host_identity !== input.hostIdentity) {
          return { status: 'conflict', reason: 'execution_replay_mismatch' };
        }
        return {
          status: 'claimed',
          claimId: row.claim_id,
          fencingToken: row.fencing_token,
          attempt: row.attempt,
          leaseExpiresAt: row.lease_expires_at,
          runnerId: row.runner_id,
          hostIdentity: row.host_identity,
        };
      }
      return activeClaimBusy(row, input.claimedAt);
    },

    async recordExecutionOutcome(input: BridgeExecutionOutcomeInput): Promise<BridgeExecutionOutcomeResult> {
      let row = await executionRow(db, input.memberId, input.directiveId);
      if (!row) return { status: 'conflict', reason: 'claim_not_found' };
      if (row.fencing_token !== input.fencingToken) return { status: 'conflict', reason: 'fencing_conflict' };
      if (row.execution_id !== input.executionId
        || row.idempotency_key !== input.idempotencyKey
        || row.runner_id !== input.runnerId
        || row.host_identity !== input.hostIdentity
        || row.claim_id !== input.claimId
        || row.attempt !== input.attempt) {
        return { status: 'conflict', reason: 'claim_mismatch' };
      }

      if (identicalOutcome(row, input)) {
        await insertOutcomeEvent(db, input);
        return { status: 'recorded', terminal: row.terminal === 1, duplicate: true };
      }
      if (row.terminal === 1 || row.attestation_id === input.attestation.id) {
        return { status: 'conflict', reason: 'outcome_conflict' };
      }

      const terminal = input.status === 'retryable' ? 0 : 1;
      const result = await db.prepare(`
        UPDATE bridge_executions
        SET outcome_status = ?, terminal = ?, attestation_json = ?, attestation_id = ?,
          attestation_digest = ?, outcome_recorded_at = ?
        WHERE member_id = ? AND directive_id = ? AND execution_id = ?
          AND claim_id = ? AND fencing_token = ? AND runner_id = ? AND host_identity = ?
          AND attempt = ? AND terminal = 0
      `).bind(
        input.status,
        terminal,
        JSON.stringify(input.attestation),
        input.attestation.id,
        input.attestationDigest,
        input.recordedAt,
        input.memberId,
        input.directiveId,
        input.executionId,
        input.claimId,
        input.fencingToken,
        input.runnerId,
        input.hostIdentity,
        input.attempt,
      ).run();

      if ((result.meta?.changes ?? 0) === 0) {
        row = await executionRow(db, input.memberId, input.directiveId);
        if (row && identicalOutcome(row, input)) {
          await insertOutcomeEvent(db, input);
          return { status: 'recorded', terminal: row.terminal === 1, duplicate: true };
        }
        if (row && row.fencing_token !== input.fencingToken) return { status: 'conflict', reason: 'fencing_conflict' };
        return { status: 'conflict', reason: 'outcome_conflict' };
      }

      await insertOutcomeEvent(db, input);
      return { status: 'recorded', terminal: terminal === 1, duplicate: false };
    },

    async hasTerminalExecution(memberId, directiveId, identity) {
      const row = await db.prepare(`
        SELECT terminal
        FROM bridge_executions
        WHERE member_id = ? AND directive_id = ? AND idempotency_key = ?
          AND input_digest = ? AND execution_id = ? AND terminal = 1
      `).bind(
        memberId,
        directiveId,
        identity.idempotencyKey,
        identity.inputDigest,
        identity.executionId,
      ).first<{ terminal: number }>();
      return row?.terminal === 1;
    },

    async acknowledgeTerminalDirective(memberId, directiveId, identity, acknowledgedAt) {
      const result = await db.prepare(`
        UPDATE bridge_directives
        SET delivered = 1, delivered_at = ?
        WHERE member_id = ? AND id = ? AND delivered = 0
          AND EXISTS (
            SELECT 1 FROM bridge_executions
            WHERE member_id = ? AND directive_id = ? AND idempotency_key = ?
              AND input_digest = ? AND execution_id = ? AND terminal = 1
          )
      `).bind(
        acknowledgedAt,
        memberId,
        directiveId,
        memberId,
        directiveId,
        identity.idempotencyKey,
        identity.inputDigest,
        identity.executionId,
      ).run();
      return (result.meta?.changes ?? 0) > 0;
    },

    async verifyActiveClaim(input) {
      const row = await db.prepare(`
        SELECT execution_id
        FROM bridge_executions
        WHERE member_id = ? AND directive_id = ? AND idempotency_key = ? AND execution_id = ?
          AND runner_id = ? AND host_identity = ? AND claim_id = ? AND fencing_token = ?
          AND attempt = ? AND terminal = 0 AND lease_expires_at > ?
      `).bind(
        input.memberId,
        input.directiveId,
        input.idempotencyKey,
        input.executionId,
        input.runnerId,
        input.hostIdentity,
        input.claimId,
        input.fencingToken,
        input.attempt,
        input.observedAt,
      ).first<{ execution_id: string }>();
      return row?.execution_id === input.executionId;
    },
  };
}

interface BridgeBusinessTaskRow {
  business_task_id: string;
  gsd_task_id: string;
  idempotency_key: string;
  intent_digest: string;
  directive_id: string;
  directive_schema: 'thoughtseed.hermes.native_execution.v1';
  member_id: string;
  tenant_id: 'thoughtseed';
  project_id: string;
  client_id: string;
  workflow_id: 'thoughtseed.legal.service-agreement.draft.v1';
  status: BridgeBusinessTaskRecord['status'];
  request_json: string;
  approval_scope: 'internal_canary_draft_only';
  approval_observation_id: string;
  approval_observed_at: string;
  synthetic: number;
  external_action: 'none';
  execution_id: string | null;
  artifact_id: string | null;
  artifact_digest: string | null;
  artifact_byte_length: number | null;
  artifact_content_type: string | null;
  artifact_r2_key: string | null;
  content_policy_id: string | null;
  content_policy_digest: string | null;
  renderer_policy_id: string | null;
  renderer_policy_digest: string | null;
  created_at: string;
  updated_at: string;
  terminal_at: string | null;
}

const BUSINESS_TASK_COLUMNS = `
  business_task_id, gsd_task_id, idempotency_key, intent_digest, directive_id, directive_schema,
  member_id, tenant_id, project_id, client_id, workflow_id, status, request_json, approval_scope,
  approval_observation_id, approval_observed_at, synthetic, external_action, execution_id,
  artifact_id, artifact_digest, artifact_byte_length, artifact_content_type, artifact_r2_key,
  content_policy_id, content_policy_digest, renderer_policy_id, renderer_policy_digest,
  created_at, updated_at, terminal_at
`;

async function businessTaskRow(db: D1DatabaseLike, businessTaskId: string): Promise<BridgeBusinessTaskRow | null> {
  return db.prepare(`SELECT ${BUSINESS_TASK_COLUMNS} FROM bridge_business_tasks WHERE business_task_id = ?`)
    .bind(businessTaskId)
    .first<BridgeBusinessTaskRow>();
}

function businessReceiptFromRow(row: BridgeBusinessTaskRow): BridgeBusinessArtifactReceipt | undefined {
  if (!row.execution_id || !row.artifact_id || !row.artifact_digest || !row.artifact_byte_length
    || !row.artifact_content_type || !row.artifact_r2_key || !row.content_policy_id
    || !row.content_policy_digest || !row.renderer_policy_id || !row.renderer_policy_digest) return undefined;
  if (row.artifact_content_type !== 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    throw new Error('business artifact content type is invalid');
  }
  return {
    schema: 'thoughtseed.business_artifact_receipt.v1',
    artifactId: row.artifact_id,
    businessTaskId: row.business_task_id,
    gsdTaskId: row.gsd_task_id,
    executionId: row.execution_id,
    directiveId: row.directive_id,
    memberId: row.member_id,
    digest: row.artifact_digest,
    byteLength: row.artifact_byte_length,
    contentType: row.artifact_content_type,
    r2Key: row.artifact_r2_key,
    contentPolicyId: row.content_policy_id,
    contentPolicyDigest: row.content_policy_digest,
    rendererPolicyId: row.renderer_policy_id,
    rendererPolicyDigest: row.renderer_policy_digest,
    approvalState: 'awaiting_human_approval',
    synthetic: true,
    externalAction: 'none',
  };
}

function businessTaskFromRow(row: BridgeBusinessTaskRow): BridgeBusinessTaskRecord {
  return {
    businessTaskId: row.business_task_id,
    gsdTaskId: row.gsd_task_id,
    idempotencyKey: row.idempotency_key,
    intentDigest: row.intent_digest,
    directiveId: row.directive_id,
    directiveSchema: row.directive_schema,
    memberId: row.member_id,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    clientId: row.client_id,
    workflowId: row.workflow_id,
    status: row.status,
    request: parseJsonRecord(row.request_json),
    approvalScope: row.approval_scope,
    approvalObservationId: row.approval_observation_id,
    approvalObservedAt: row.approval_observed_at,
    synthetic: true,
    externalAction: 'none',
    ...(row.execution_id ? { executionId: row.execution_id } : {}),
    ...(businessReceiptFromRow(row) ? { receipt: businessReceiptFromRow(row) } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    ...(row.terminal_at ? { terminalAt: row.terminal_at } : {}),
  };
}

function sameBusinessTaskIdentity(row: BridgeBusinessTaskRow, record: BridgeBusinessTaskRecord): boolean {
  return row.business_task_id === record.businessTaskId
    && row.gsd_task_id === record.gsdTaskId
    && row.idempotency_key === record.idempotencyKey
    && row.intent_digest === record.intentDigest
    && row.directive_id === record.directiveId
    && row.member_id === record.memberId
    && row.tenant_id === record.tenantId
    && row.project_id === record.projectId
    && row.client_id === record.clientId
    && row.workflow_id === record.workflowId;
}

async function digestBusinessBytes(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return `sha256:${[...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('')}`;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary);
}

export function d1BridgeBusinessTaskStore(db: D1DatabaseLike, bucket: R2BucketLike): BridgeBusinessTaskStoreLike {
  if (!bucket.put || !bucket.head) throw new Error('business artifact R2 binding is not writable');
  return {
    async createTask(record) {
      const result = await db.prepare(`
        INSERT OR IGNORE INTO bridge_business_tasks (
          business_task_id, gsd_task_id, idempotency_key, intent_digest, directive_id, directive_schema,
          member_id, tenant_id, project_id, client_id, workflow_id, status, request_json, approval_scope,
          approval_observation_id, approval_observed_at, synthetic, external_action, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 'none', ?, ?)
      `).bind(
        record.businessTaskId,
        record.gsdTaskId,
        record.idempotencyKey,
        record.intentDigest,
        record.directiveId,
        record.directiveSchema,
        record.memberId,
        record.tenantId,
        record.projectId,
        record.clientId,
        record.workflowId,
        record.status,
        JSON.stringify(record.request),
        record.approvalScope,
        record.approvalObservationId,
        record.approvalObservedAt,
        record.createdAt,
        record.updatedAt,
      ).run();
      if ((result.meta?.changes ?? 0) > 0) return 'created';
      const existing = await db.prepare(`
        SELECT ${BUSINESS_TASK_COLUMNS}
        FROM bridge_business_tasks
        WHERE business_task_id = ? OR gsd_task_id = ? OR idempotency_key = ? OR directive_id = ?
        LIMIT 1
      `).bind(record.businessTaskId, record.gsdTaskId, record.idempotencyKey, record.directiveId)
        .first<BridgeBusinessTaskRow>();
      return existing && sameBusinessTaskIdentity(existing, record) ? 'duplicate' : 'conflict';
    },

    async getTask(businessTaskId) {
      const row = await businessTaskRow(db, businessTaskId);
      return row ? businessTaskFromRow(row) : null;
    },

    async markLeased(businessTaskId, executionId, recordedAt) {
      const result = await db.prepare(`
        UPDATE bridge_business_tasks
        SET status = 'leased', execution_id = ?, updated_at = ?
        WHERE business_task_id = ?
          AND status IN ('queued', 'leased', 'rendering', 'retrying')
          AND (execution_id IS NULL OR execution_id = ?)
      `).bind(executionId, recordedAt, businessTaskId, executionId).run();
      if ((result.meta?.changes ?? 0) > 0) return;
      const row = await businessTaskRow(db, businessTaskId);
      if (!row || row.execution_id !== executionId
        || !['artifact_stored', 'awaiting_human_approval'].includes(row.status)) {
        throw new Error('business task lease transition conflict');
      }
    },

    async putArtifact(input: BridgeBusinessArtifactUpload) {
      const current = await businessTaskRow(db, input.task.businessTaskId);
      if (!current || current.execution_id !== input.executionId) throw new Error('business artifact execution mismatch');
      const r2Key = `business-artifacts/thoughtseed/${input.task.gsdTaskId}/${input.artifactId}.docx`;
      const receipt: BridgeBusinessArtifactReceipt = {
        schema: 'thoughtseed.business_artifact_receipt.v1',
        artifactId: input.artifactId,
        businessTaskId: input.task.businessTaskId,
        gsdTaskId: input.task.gsdTaskId,
        executionId: input.executionId,
        directiveId: input.task.directiveId,
        memberId: input.task.memberId,
        digest: input.digest,
        byteLength: input.byteLength,
        contentType: input.contentType,
        r2Key,
        contentPolicyId: input.contentPolicyId,
        contentPolicyDigest: input.contentPolicyDigest,
        rendererPolicyId: input.rendererPolicyId,
        rendererPolicyDigest: input.rendererPolicyDigest,
        approvalState: 'awaiting_human_approval',
        synthetic: true,
        externalAction: 'none',
      };
      const existingReceipt = businessReceiptFromRow(current);
      if (existingReceipt) {
        if (JSON.stringify(existingReceipt) !== JSON.stringify(receipt)) throw new Error('business artifact identity conflict');
        const head = await bucket.head!(r2Key);
        if (!head || head.size !== input.byteLength || head.customMetadata?.digest !== input.digest) {
          throw new Error('business artifact receipt exists without matching R2 object');
        }
        return { stored: true, duplicate: true, receipt };
      }

      let stored = false;
      try {
        const object = await bucket.put!(r2Key, input.bytes, {
          onlyIf: { etagDoesNotMatch: '*' },
          httpMetadata: { contentType: input.contentType },
          customMetadata: {
            digest: input.digest,
            artifactId: input.artifactId,
            businessTaskId: input.task.businessTaskId,
            executionId: input.executionId,
          },
        });
        stored = object !== null;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (!/precondition|412/i.test(message)) throw error;
      }
      if (!stored) {
        const head = await bucket.head!(r2Key);
        if (!head || head.size !== input.byteLength || head.customMetadata?.digest !== input.digest) {
          throw new Error('business artifact create-if-absent conflict');
        }
      }

      const updated = await db.prepare(`
        UPDATE bridge_business_tasks
        SET status = 'artifact_stored', artifact_id = ?, artifact_digest = ?, artifact_byte_length = ?,
          artifact_content_type = ?, artifact_r2_key = ?, content_policy_id = ?, content_policy_digest = ?,
          renderer_policy_id = ?, renderer_policy_digest = ?, updated_at = ?
        WHERE business_task_id = ? AND execution_id = ? AND artifact_id IS NULL
      `).bind(
        input.artifactId,
        input.digest,
        input.byteLength,
        input.contentType,
        r2Key,
        input.contentPolicyId,
        input.contentPolicyDigest,
        input.rendererPolicyId,
        input.rendererPolicyDigest,
        input.recordedAt,
        input.task.businessTaskId,
        input.executionId,
      ).run();
      if ((updated.meta?.changes ?? 0) === 0) {
        const raced = await businessTaskRow(db, input.task.businessTaskId);
        const racedReceipt = raced ? businessReceiptFromRow(raced) : undefined;
        if (!racedReceipt || JSON.stringify(racedReceipt) !== JSON.stringify(receipt)) {
          throw new Error('business artifact D1 identity conflict');
        }
        return { stored: true, duplicate: true, receipt };
      }
      return { stored: true, duplicate: !stored, receipt };
    },

    async markOutcome(businessTaskId, status, recordedAt) {
      const terminalAt = status === 'retrying' ? null : recordedAt;
      const result = await db.prepare(`
        UPDATE bridge_business_tasks
        SET status = ?, updated_at = ?, terminal_at = ?
        WHERE business_task_id = ?
          AND (
            (? = 'awaiting_human_approval' AND artifact_id IS NOT NULL)
            OR (? = 'retrying' AND terminal_at IS NULL)
            OR (? = 'failed' AND artifact_id IS NULL)
          )
      `).bind(status, recordedAt, terminalAt, businessTaskId, status, status, status).run();
      if ((result.meta?.changes ?? 0) > 0) return;
      const row = await businessTaskRow(db, businessTaskId);
      if (!row || row.status !== status) throw new Error('business task outcome transition conflict');
    },

    async getArtifact(businessTaskId) {
      const row = await businessTaskRow(db, businessTaskId);
      if (!row) return null;
      const receipt = businessReceiptFromRow(row);
      if (!receipt) return null;
      const object = await bucket.get(receipt.r2Key);
      if (!object?.arrayBuffer) throw new Error('business artifact R2 object is unreadable');
      const bytes = new Uint8Array(await object.arrayBuffer());
      if (bytes.byteLength !== receipt.byteLength || await digestBusinessBytes(bytes) !== receipt.digest) {
        throw new Error('business artifact R2 readback digest mismatch');
      }
      return { receipt, base64: bytesToBase64(bytes) };
    },
  };
}

function fabricTenant(record: { tenantId?: string; payload?: Record<string, unknown> }): string {
  const payloadTenant = record.payload && typeof record.payload.tenantId === 'string' ? record.payload.tenantId : undefined;
  return record.tenantId ?? payloadTenant ?? 'cambium';
}

export function d1FabricLedgerStore(db: D1DatabaseLike): FabricLedgerStoreLike {
  const taskFromRow = (row: any): FabricLedgerTaskRecord => ({
    tenantId: row.tenant_id,
    taskId: row.task_id,
    projectId: row.project_id,
    memberId: row.member_id,
    status: row.status,
    workMode: row.work_mode,
    evidenceStrength: row.evidence_strength,
    title: row.title,
    payload: parseJsonRecord(row.payload_json),
    updatedAt: row.updated_at,
  });
  const eventFromRow = (row: any): FabricLedgerEventRecord => ({
    tenantId: row.tenant_id,
    eventId: row.event_id,
    taskId: row.task_id,
    projectId: row.project_id,
    memberId: row.member_id,
    type: row.type,
    source: row.source,
    payloadHash: row.payload_hash,
    upstreamPayloadHash: row.upstream_payload_hash,
    payload: parseJsonRecord(row.payload_json),
    correlationId: row.correlation_id,
    receivedAt: row.received_at,
  });
  const candidateFromRow = (row: any): FabricEvidenceCandidateRecord => ({
    tenantId: row.tenant_id,
    candidateId: row.candidate_id,
    taskId: row.task_id,
    projectId: row.project_id,
    memberId: row.member_id,
    status: row.status,
    confidence: row.confidence,
    matchKind: row.match_kind,
    evidence: parseJsonRecord(row.evidence_json),
    reason: row.reason,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    reviewActor: row.review_actor,
    reviewReason: row.review_reason,
  });
  return {
    async getEvent(eventId, tenantId = 'cambium') {
      const row = await db.prepare(`
        SELECT tenant_id, event_id, task_id, project_id, member_id, type, source, payload_hash,
          upstream_payload_hash, payload_json, correlation_id, received_at
        FROM fabric_task_events
        WHERE tenant_id = ? AND event_id = ?
      `).bind(tenantId, eventId).first<any>();
      return row ? eventFromRow(row) : null;
    },
    async putEvent(record) {
      const tenantId = fabricTenant(record);
      const result = await db.prepare(`
        INSERT OR IGNORE INTO fabric_task_events (
          tenant_id, event_id, task_id, project_id, member_id, type, source, payload_hash,
          upstream_payload_hash, payload_json, correlation_id, received_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        tenantId,
        record.eventId,
        record.taskId,
        record.projectId,
        record.memberId,
        record.type,
        record.source,
        record.payloadHash,
        record.upstreamPayloadHash ?? null,
        JSON.stringify(record.payload),
        record.correlationId ?? null,
        record.receivedAt,
      ).run();
      return (result.meta?.changes ?? 0) > 0;
    },
    async getTask(taskId, tenantId = 'cambium') {
      const row = await db.prepare(`
        SELECT tenant_id, task_id, project_id, member_id, status, work_mode, evidence_strength, title, payload_json, updated_at
        FROM fabric_tasks
        WHERE tenant_id = ? AND task_id = ?
      `).bind(tenantId, taskId).first<any>();
      return row ? taskFromRow(row) : null;
    },
    async findTasks(tenantId = 'cambium') {
      const rows = (await db.prepare(`
        SELECT tenant_id, task_id, project_id, member_id, status, work_mode, evidence_strength, title, payload_json, updated_at
        FROM fabric_tasks
        WHERE tenant_id = ?
        ORDER BY updated_at DESC
        LIMIT 500
      `).bind(tenantId).all<any>()).results ?? [];
      return rows.map(taskFromRow);
    },
    async upsertTask(record) {
      const tenantId = fabricTenant(record);
      await db.prepare(`
        INSERT INTO fabric_tasks (
          tenant_id, task_id, project_id, member_id, status, work_mode, evidence_strength, title, payload_json, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tenant_id, task_id) DO UPDATE SET
          project_id = excluded.project_id,
          member_id = excluded.member_id,
          status = excluded.status,
          work_mode = excluded.work_mode,
          evidence_strength = excluded.evidence_strength,
          title = excluded.title,
          payload_json = excluded.payload_json,
          updated_at = excluded.updated_at
      `).bind(
        tenantId,
        record.taskId,
        record.projectId,
        record.memberId,
        record.status,
        record.workMode ?? null,
        record.evidenceStrength,
        record.title ?? null,
        JSON.stringify({ ...record.payload, tenantId }),
        record.updatedAt,
      ).run();
    },
    async putEvidenceCandidate(record) {
      const tenantId = fabricTenant(record);
      await db.prepare(`
        INSERT OR REPLACE INTO fabric_evidence_candidates (
          tenant_id, candidate_id, task_id, project_id, member_id, status, confidence, match_kind, evidence_json,
          reason, created_at, reviewed_at, review_actor, review_reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        tenantId,
        record.candidateId,
        record.taskId,
        record.projectId,
        record.memberId,
        record.status,
        record.confidence,
        record.matchKind,
        JSON.stringify(record.evidence),
        record.reason,
        record.createdAt,
        record.reviewedAt ?? null,
        record.reviewActor ?? null,
        record.reviewReason ?? null,
      ).run();
    },
    async getEvidenceCandidate(candidateId, tenantId = 'cambium') {
      const row = await db.prepare(`
        SELECT tenant_id, candidate_id, task_id, project_id, member_id, status, confidence, match_kind, evidence_json,
          reason, created_at, reviewed_at, review_actor, review_reason
        FROM fabric_evidence_candidates
        WHERE tenant_id = ? AND candidate_id = ?
      `).bind(tenantId, candidateId).first<any>();
      return row ? candidateFromRow(row) : null;
    },
    async listReviewItems(tenantId = 'cambium') {
      const rows = (await db.prepare(`
        SELECT tenant_id, candidate_id, task_id, project_id, member_id, status, confidence, match_kind, evidence_json,
          reason, created_at, reviewed_at, review_actor, review_reason
        FROM fabric_evidence_candidates
        WHERE tenant_id = ? AND status = 'review_pending'
        ORDER BY created_at ASC
        LIMIT 200
      `).bind(tenantId).all<any>()).results ?? [];
      return rows.map(candidateFromRow);
    },
    async updateEvidenceCandidate(record) {
      const tenantId = fabricTenant(record);
      await db.prepare(`
        UPDATE fabric_evidence_candidates
        SET status = ?, confidence = ?, match_kind = ?, evidence_json = ?, reason = ?,
          reviewed_at = ?, review_actor = ?, review_reason = ?
        WHERE tenant_id = ? AND candidate_id = ?
      `).bind(
        record.status,
        record.confidence,
        record.matchKind,
        JSON.stringify(record.evidence),
        record.reason,
        record.reviewedAt ?? null,
        record.reviewActor ?? null,
        record.reviewReason ?? null,
        tenantId,
        record.candidateId,
      ).run();
    },
    async putEvidenceReview(record: FabricEvidenceReviewRecord) {
      const tenantId = record.tenantId ?? 'cambium';
      await db.prepare(`
        INSERT OR IGNORE INTO fabric_evidence_reviews (tenant_id, review_id, candidate_id, outcome, actor, reason, reviewed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        tenantId,
        record.reviewId,
        record.candidateId,
        record.outcome,
        record.actor,
        record.reason ?? null,
        record.reviewedAt,
      ).run();
    },
  };
}

/** Prefer Worker secret env; fall back to Labs SECRETS KV (cambium-secrets). */
async function resolveSecret(
  env: Env,
  name: 'OPENCODE_API_KEY' | 'EXPLEE_API_KEY',
): Promise<string | undefined> {
  const fromEnv = env[name]?.trim();
  if (fromEnv) return fromEnv;
  const fromKv = (await env.SECRETS?.get(name))?.trim();
  return fromKv || undefined;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const headers: Record<string, string> = {};
    request.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
    const simple: SimpleRequest = {
      method: request.method,
      path: `${url.pathname}${url.search}`,
      headers,
      body: ['POST', 'PUT'].includes(request.method) ? await request.text() : undefined,
    };
    const kv = {
      get: (key: string) => env.QUESTS.get(key),
      put: (key: string, value: string) => env.QUESTS.put(key, value),
      list: async (prefix: string) => (await env.QUESTS.list({ prefix })).keys.map((k) => k.name),
    };
    const gate = env.GATE_BOT_ID && env.GATE_FOUNDER_IDS ? {
      botId: env.GATE_BOT_ID,
      pubKeyHex: env.GATE_TG_PUBKEY || TELEGRAM_PROD_PUBKEY,
      founderIds: env.GATE_FOUNDER_IDS.split(',').map((s) => s.trim()),
    } : undefined;
    const opencodeApiKey = await resolveSecret(env, 'OPENCODE_API_KEY');
    const expleeApiKey = await resolveSecret(env, 'EXPLEE_API_KEY');
    const providers: Record<string, ProviderConfig | undefined> = {
      ollama: env.OLLAMA_API_KEY ? {
        apiKey: env.OLLAMA_API_KEY,
        baseUrl: env.OLLAMA_BASE_URL || 'https://ollama.com/v1',
        defaultModel: env.OLLAMA_DEFAULT_MODEL || 'kimi-k2.7-code:cloud',
        models: env.OLLAMA_DEFAULT_MODEL ? [env.OLLAMA_DEFAULT_MODEL] : ['kimi-k2.7-code:cloud'],
      } : undefined,
      nvidia: env.NVIDIA_API_KEY ? {
        apiKey: env.NVIDIA_API_KEY,
        baseUrl: env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
        defaultModel: env.NVIDIA_DEFAULT_MODEL || 'meta/llama-3.1-70b-instruct',
        models: env.NVIDIA_DEFAULT_MODEL ? [env.NVIDIA_DEFAULT_MODEL] : ['meta/llama-3.1-70b-instruct'],
      } : undefined,
      nebius: env.NEBIUS_API_KEY ? {
        apiKey: env.NEBIUS_API_KEY,
        baseUrl: env.NEBIUS_BASE_URL || 'https://api.tokenfactory.nebius.com/v1',
        defaultModel: env.NEBIUS_DEFAULT_MODEL || 'Qwen/Qwen3-235B-A22B-Instruct-2507',
        models: env.NEBIUS_DEFAULT_MODEL ? [env.NEBIUS_DEFAULT_MODEL] : ['Qwen/Qwen3-235B-A22B-Instruct-2507'],
      } : undefined,
      // Command Code's supported Provider API is OpenAI-compatible. Keep this route
      // byte-transparent so server traffic does not depend on the private CLI
      // /alpha/generate protocol retained by command-code-adapter.ts.
      'command-code': env.COMMAND_CODE_API_KEY ? {
        apiKey: env.COMMAND_CODE_API_KEY,
        baseUrl: env.COMMAND_CODE_BASE_URL || 'https://api.commandcode.ai/provider/v1',
        defaultModel: env.COMMAND_CODE_DEFAULT_MODEL || 'deepseek/deepseek-v4-flash',
        models: env.COMMAND_CODE_DEFAULT_MODEL ? [env.COMMAND_CODE_DEFAULT_MODEL] : ['deepseek/deepseek-v4-flash'],
        staticHeaders: env.COMMAND_CODE_EGRESS_TOKEN
          ? { 'x-hermes-egress-token': env.COMMAND_CODE_EGRESS_TOKEN }
          : undefined,
      } : undefined,
      // Anthropic-shaped, unlike the OpenAI three above: the key goes in x-api-key
      // rather than `authorization: Bearer`, and the caller's anthropic-version header
      // has to reach the upstream. Callers use /messages, not /chat/completions.
      'kimi-coding': env.KIMI_CODING_API_KEY ? {
        apiKey: env.KIMI_CODING_API_KEY,
        baseUrl: env.KIMI_CODING_BASE_URL || 'https://api.kimi.com/coding/v1',
        defaultModel: env.KIMI_CODING_DEFAULT_MODEL || 'k3',
        models: env.KIMI_CODING_DEFAULT_MODEL ? [env.KIMI_CODING_DEFAULT_MODEL] : ['k3'],
        authHeader: 'x-api-key',
      } : undefined,
      // opencode zen: one OpenAI-shaped key fronting a multi-vendor catalog
      // (claude-*, gpt-5.*, kimi, glm, deepseek, grok, gemini + free lanes).
      // This is the only broker route to Claude-class models on EC2 — the
      // device-bound claude OAuth connection cannot follow off the Mac.
      // Key: Worker secret or Labs SECRETS KV (OPENCODE_API_KEY).
      opencode: opencodeApiKey ? {
        apiKey: opencodeApiKey,
        baseUrl: env.OPENCODE_BASE_URL || 'https://opencode.ai/zen/v1',
        defaultModel: env.OPENCODE_DEFAULT_MODEL || 'deepseek-v4-flash',
        models: env.OPENCODE_DEFAULT_MODEL ? [env.OPENCODE_DEFAULT_MODEL] : ['deepseek-v4-flash'],
      } : undefined,
    };
    const workerFetch = fetch.bind(globalThis);
    const providerBroker = env.PROVIDER_BROKER_TOKEN ? {
      token: env.PROVIDER_BROKER_TOKEN,
      providers,
      fetch: fetch.bind(globalThis),
    } : undefined;
    let contextRoutes: ContextRouteDeps | undefined;
    if (env.CONTEXT_ROUTE_TOKEN) {
      const embeddingProviderId = env.CONTEXT_EMBEDDING_PROVIDER?.trim() || 'nvidia';
      const embeddingProvider = providers[embeddingProviderId];
      const embed = createProviderEmbedder({
        provider: embeddingProvider,
        model: env.CONTEXT_EMBEDDING_MODEL?.trim() || embeddingProvider?.defaultModel,
        fetchImpl: workerFetch,
      });
      contextRoutes = {
        token: env.CONTEXT_ROUTE_TOKEN,
        allowedTenants: parseAllowedTenants(env.CONTEXT_ALLOWED_TENANTS),
        routineContext: createGithubRoutineContext({
          token: env.GITHUB_KNOWLEDGE_TOKEN,
          repository: env.GITHUB_KNOWLEDGE_REPOSITORY,
          ref: env.GITHUB_KNOWLEDGE_REF,
          allowlist: parseGithubKnowledgeAllowlistJson(env.GITHUB_KNOWLEDGE_ROUTINE_ALLOWLIST_JSON),
          fetchImpl: workerFetch,
        }),
        semanticRecall: embed && env.CAMBIUM_CORTEX
          ? createSemanticRecall({ embed, vectorIndex: env.CAMBIUM_CORTEX })
          : undefined,
      };
    }
    const githubAllowedRepos = parseAllowedRepos(env.GITHUB_AGENT_ALLOWED_REPOS);
    const iverifApiKey = expleeApiKey;
    const iverifReadToken = env.IVERIF_READ_TOKEN?.trim();
    const iverifExplee = iverifApiKey ? createIVerifExpleeObserver({
      apiKey: iverifApiKey,
      fetchImpl: workerFetch,
    }) : undefined;
    const res = await handle(simple, {
      kv,
      pushToken: env.QUESTS_PUSH_TOKEN,
      gate,
      bridgeToken: env.BRIDGE_TOKEN,
      assignmentToken: env.HERMES_ASSIGNMENT_TOKEN,
      roleTaskBindingsJson: env.HERMES_ROLE_TASK_BINDINGS_JSON,
      bridgeStore: env.BRIDGE_DB ? d1BridgeStore(env.BRIDGE_DB) : undefined,
      executionStore: env.BRIDGE_DB ? d1BridgeExecutionStore(env.BRIDGE_DB) : undefined,
      businessStore: env.BRIDGE_DB && env.THOUGHTSEED_VAULT
        ? d1BridgeBusinessTaskStore(env.BRIDGE_DB, env.THOUGHTSEED_VAULT)
        : undefined,
      fabricLedger: env.BRIDGE_DB ? d1FabricLedgerStore(env.BRIDGE_DB) : undefined,
      handoffSecret: env.HANDOFF_SECRET,
      providerBroker,
      contextRoutes,
      iverifReadToken,
      iverifProviderApiKey: iverifApiKey,
      iverifExplee,
      leadRuntimeStore: env.BRIDGE_DB ? d1LeadRuntimeStore(env.BRIDGE_DB) : undefined,
      marketingRenderStore: env.BRIDGE_DB ? d1MarketingRenderStore(env.BRIDGE_DB) : undefined,
      goalGraphStore: env.BRIDGE_DB ? d1GoalGraphStore(env.BRIDGE_DB) : undefined,
      branchMapReceiptStore: env.BRIDGE_DB ? d1BranchMapReceiptStore(env.BRIDGE_DB) : undefined,
      portfolioActionStore: env.THOUGHTSEED_VAULT?.put
        ? createPortfolioAdminActionStore(env.THOUGHTSEED_VAULT)
        : undefined,
      portfolioActionQueue: createPortfolioAdminActionQueue(kv),
      branchMapTenants: parseAllowedTenants(env.GATE_BRANCH_MAP_TENANTS),
      missionFabricTenants: parseAllowedTenants(env.MISSION_FABRIC_TENANTS),
      missionFabricViewerIds: parseAllowedUserIds(env.MISSION_FABRIC_VIEWER_IDS),
      plexus: env.TF_ACCESS_TEAM_DOMAIN && env.TF_ACCESS_AUD ? {
        teamDomain: env.TF_ACCESS_TEAM_DOMAIN,
        aud: env.TF_ACCESS_AUD,
        whoamiUrl: env.PLEXUS_WHOAMI_URL,
      } : undefined,
      marketingRenderer: {
        activation: env.MARKETING_CREATE_ACTIVATION,
        apiKey: env.NVIDIA_MARKETING_CREATE_API_KEY,
        fetchImpl: workerFetch,
      },
      githubCommand: env.GITHUB_AGENT_TOKEN ? createGithubCommandExecutor({
        token: env.GITHUB_AGENT_TOKEN,
        allowedRepos: githubAllowedRepos,
        fetch: workerFetch,
      }) : undefined,
      githubAllowedRepos,
      publicBaseUrl: new URL(request.url).origin,
    });
    return new Response(res.body, { status: res.status, headers: res.headers });
  },
};

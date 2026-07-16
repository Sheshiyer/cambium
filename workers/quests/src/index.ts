// cambium-quests · Workers runtime glue. All logic lives in handler.ts (pure, node:test-covered).

import { handle, TELEGRAM_PROD_PUBKEY } from './handler.ts';
import {
  DEFAULT_ROUTINE_CONTEXT_SLICES,
  createProviderEmbedder,
  createRoutineContext,
  createSemanticRecall,
  parseRoutineAllowlistJson,
} from './context-bindings.ts';
import { createGithubCommandExecutor, parseAllowedRepos } from './github-command.ts';
import { createIVerifExpleeObserver } from './iverif-explee.ts';
import type {
  BridgeAssignmentRecord,
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
  QUESTS: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
    list(opts: { prefix: string }): Promise<{ keys: Array<{ name: string }> }>;
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
  CONTEXT_ROUTINE_ALLOWLIST_JSON?: string;
  GITHUB_AGENT_TOKEN?: string;
  GITHUB_AGENT_ALLOWED_REPOS?: string;
  OLLAMA_API_KEY?: string;
  OLLAMA_BASE_URL?: string;
  OLLAMA_DEFAULT_MODEL?: string;
  NVIDIA_API_KEY?: string;
  NVIDIA_BASE_URL?: string;
  NVIDIA_DEFAULT_MODEL?: string;
  NEBIUS_API_KEY?: string;
  NEBIUS_BASE_URL?: string;
  NEBIUS_DEFAULT_MODEL?: string;
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
  if ((row.outcome_status !== 'executed' && row.outcome_status !== 'failed')
    || attestation.schema !== 'thoughtseed.hermes.execution_attestation.v1'
    || typeof attestation.id !== 'string'
    || typeof attestation.executionId !== 'string'
    || typeof attestation.directiveId !== 'string'
    || typeof attestation.idempotencyKey !== 'string'
    || typeof attestation.runnerId !== 'string'
    || typeof attestation.hostIdentity !== 'string'
    || attestation.command !== 'canary.record'
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
    command: 'canary.record' as const,
    status: row.outcome_status,
    exitCode: attestation.exitCode as 0 | 1,
    inputDigest: attestation.inputDigest,
    ...(typeof attestation.outputDigest === 'string' ? { outputDigest: attestation.outputDigest } : {}),
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
        routineContext: env.THOUGHTSEED_VAULT ? createRoutineContext({
          bucket: env.THOUGHTSEED_VAULT,
          allowlist: {
            ...DEFAULT_ROUTINE_CONTEXT_SLICES,
            ...(parseRoutineAllowlistJson(env.CONTEXT_ROUTINE_ALLOWLIST_JSON) ?? {}),
          },
        }) : undefined,
        semanticRecall: embed && env.CAMBIUM_CORTEX
          ? createSemanticRecall({ embed, vectorIndex: env.CAMBIUM_CORTEX })
          : undefined,
      };
    }
    const githubAllowedRepos = parseAllowedRepos(env.GITHUB_AGENT_ALLOWED_REPOS);
    const iverifApiKey = env.EXPLEE_API_KEY?.trim();
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
      fabricLedger: env.BRIDGE_DB ? d1FabricLedgerStore(env.BRIDGE_DB) : undefined,
      handoffSecret: env.HANDOFF_SECRET,
      providerBroker,
      contextRoutes,
      iverifReadToken,
      iverifExplee,
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

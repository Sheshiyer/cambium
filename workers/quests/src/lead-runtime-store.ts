export interface LeadD1StatementLike {
  bind(...values: unknown[]): LeadD1StatementLike;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results?: T[] }>;
  run(): Promise<{ meta?: { changes?: number } }>;
}

export interface LeadD1DatabaseLike {
  prepare(sql: string): LeadD1StatementLike;
}

export interface CanonicalLead {
  leadId: string;
  tenantId: string;
  normalizedEmail: string | null;
  createdAt: string;
}

export interface LeadObservationReceipt {
  observationReceiptId: string;
  tenantId: string;
  leadId: string;
  providerId: string;
  sourceId: string;
  method: 'GET';
  idempotencyKey: string;
  observationDigest: string;
  observedAt: string;
  recordedAt: string;
}

export interface LeadSpendReservation {
  reservationId: string;
  tenantId: string;
  taskId: string;
  providerId: string;
  idempotencyKey: string;
  unit: 'usd_micros';
  reservedUnits: number;
  settledUnits: number | null;
  status: 'reserved' | 'settled';
  createdAt: string;
  settledAt: string | null;
}

export interface LeadProviderUsage {
  usageId: string;
  tenantId: string;
  taskId: string;
  reservationId: string;
  providerId: string;
  idempotencyKey: string;
  unit: 'usd_micros';
  usedUnits: number;
  receiptDigest: string;
  recordedAt: string;
}

export type LeadTaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'stopped';

export interface LeadLoopTask {
  taskId: string;
  tenantId: string;
  idempotencyKey: string;
  inputDigest: string;
  status: LeadTaskStatus;
  claimId: string | null;
  fencingToken: number;
  leaseExpiresAt: string | null;
  receipt: LeadTaskReceipt | null;
  errorCode: string | null;
  stopReason: string | null;
  createdAt: string;
  updatedAt: string;
  terminalAt: string | null;
}

export interface LeadTaskReceipt {
  schemaVersion: 'lead_operator_receipt@1.0.0';
  taskId: string;
  state: 'completed';
  leadId: string;
  observationCount: number;
  stagesCompleted: number;
  spendUnits: number;
  replayed: boolean;
  updatedAt: string;
}

export interface LeadCortexFoldback {
  foldbackId: string;
  tenantId: string;
  taskId: string;
  transformationVersion: string;
  leadsCaptured: number;
  observationsRecorded: number;
  stagesCompleted: number;
  spendUnits: number;
  completedAt: string;
}

export type CaptureLeadResult =
  | { status: 'created' | 'duplicate'; lead: CanonicalLead }
  | { status: 'conflict'; code: string };

export type RecordObservationResult =
  | { status: 'recorded' | 'duplicate'; receipt: LeadObservationReceipt }
  | { status: 'conflict'; code: string };

export type ReserveSpendResult =
  | { status: 'reserved' | 'duplicate'; reservation: LeadSpendReservation }
  | { status: 'conflict'; code: string };

export type SettleUsageResult =
  | { status: 'recorded' | 'duplicate'; usage: LeadProviderUsage }
  | { status: 'conflict'; code: string };

export type CreateLeadTaskResult =
  | { status: 'pending' | 'duplicate'; task: LeadLoopTask }
  | { status: 'conflict'; code: string };

export type ClaimLeadTaskResult =
  | { status: 'claimed'; taskId: string; claimId: string; fencingToken: number; leaseExpiresAt: string }
  | { status: 'busy'; retryAfterMs: number }
  | { status: 'terminal'; state: 'completed'; receipt: LeadTaskReceipt }
  | { status: 'terminal'; state: 'failed' | 'stopped'; code: string }
  | { status: 'conflict'; code: string };

export interface LeadRuntimeStoreLike {
  captureLead(input: {
    leadId: string;
    aliasId: string;
    tenantId: string;
    providerId: string;
    sourceId: string;
    normalizedEmail?: string | null;
    observedAt: string;
  }): Promise<CaptureLeadResult>;
  getLead(tenantId: string, leadId: string): Promise<CanonicalLead | null>;
  recordObservation(input: LeadObservationReceipt): Promise<RecordObservationResult>;
  getObservation(tenantId: string, idempotencyKey: string): Promise<LeadObservationReceipt | null>;
  createTask(input: {
    taskId: string;
    tenantId: string;
    idempotencyKey: string;
    inputDigest: string;
    createdAt: string;
  }): Promise<CreateLeadTaskResult>;
  getTask(tenantId: string, taskId: string): Promise<LeadLoopTask | null>;
  claimTask(input: {
    taskId: string;
    tenantId: string;
    inputDigest: string;
    claimId: string;
    claimedAt: string;
    leaseExpiresAt: string;
  }): Promise<ClaimLeadTaskResult>;
  stopTask(input: {
    taskId: string;
    claimId: string;
    fencingToken: number;
    reason: string;
    stoppedAt: string;
  }): Promise<'recorded' | 'replay' | 'conflict'>;
  completeTask(input: {
    taskId: string;
    claimId: string;
    fencingToken: number;
    receipt: LeadTaskReceipt;
    completedAt: string;
  }): Promise<{ status: 'recorded' | 'replay'; receipt: LeadTaskReceipt } | { status: 'conflict' }>;
  failTask(input: {
    taskId: string;
    claimId: string;
    fencingToken: number;
    errorCode: string;
    failedAt: string;
  }): Promise<'recorded' | 'replay' | 'conflict'>;
  reserveSpend(input: {
    reservationId: string;
    tenantId: string;
    taskId: string;
    providerId: string;
    idempotencyKey: string;
    reservedUnits: number;
    createdAt: string;
  }): Promise<ReserveSpendResult>;
  getSpendReservation(tenantId: string, idempotencyKey: string): Promise<LeadSpendReservation | null>;
  settleUsage(input: {
    usageId: string;
    tenantId: string;
    taskId: string;
    reservationId: string;
    providerId: string;
    idempotencyKey: string;
    usedUnits: number;
    receiptDigest: string;
    recordedAt: string;
  }): Promise<SettleUsageResult>;
  getProviderUsage(tenantId: string, idempotencyKey: string): Promise<LeadProviderUsage | null>;
  recordFoldback(input: {
    foldbackId: string;
    tenantId: string;
    taskId: string;
  }): Promise<'recorded' | 'duplicate' | 'conflict'>;
  getFoldback(tenantId: string, taskId: string): Promise<LeadCortexFoldback | null>;
}

interface LeadRow {
  lead_id: string;
  tenant_id: string;
  normalized_email: string | null;
  created_at: string;
}

interface AliasRow extends LeadRow {
  alias_id: string;
  provider_id: string;
  source_id: string;
}

interface ObservationRow {
  observation_receipt_id: string;
  tenant_id: string;
  lead_id: string;
  provider_id: string;
  source_id: string;
  method: 'GET';
  idempotency_key: string;
  observation_digest: string;
  observed_at: string;
  recorded_at: string;
}

interface TaskRow {
  task_id: string;
  tenant_id: string;
  idempotency_key: string;
  input_digest: string;
  status: LeadTaskStatus;
  claim_id: string | null;
  fencing_token: number;
  lease_expires_at: string | null;
  receipt_json: string | null;
  error_code: string | null;
  stop_reason: string | null;
  created_at: string;
  updated_at: string;
  terminal_at: string | null;
}

interface ReservationRow {
  reservation_id: string;
  tenant_id: string;
  task_id: string;
  provider_id: string;
  idempotency_key: string;
  unit: 'usd_micros';
  reserved_units: number;
  settled_units: number | null;
  status: 'reserved' | 'settled';
  created_at: string;
  settled_at: string | null;
}

interface UsageRow {
  usage_id: string;
  tenant_id: string;
  task_id: string;
  reservation_id: string;
  provider_id: string;
  idempotency_key: string;
  unit: 'usd_micros';
  used_units: number;
  receipt_digest: string;
  recorded_at: string;
}

interface FoldbackRow {
  foldback_id: string;
  tenant_id: string;
  task_id: string;
  transformation_version: string;
  leads_captured: number;
  observations_recorded: number;
  stages_completed: number;
  spend_units: number;
  completed_at: string;
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function changes(result: { meta?: { changes?: number } }): number {
  return Number(result.meta?.changes ?? 0);
}

function validId(value: string): boolean {
  return typeof value === 'string' && SAFE_ID.test(value);
}

function validTimestamp(value: string): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validUnits(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function normalizeEmail(value: string | null | undefined): string | null | undefined {
  if (value === undefined || value === null) return value;
  const normalized = value.normalize('NFKC').trim().toLowerCase();
  if (normalized.length > 320 || !EMAIL.test(normalized)) return undefined;
  return normalized;
}

function leadFromRow(row: LeadRow | null): CanonicalLead | null {
  return row ? {
    leadId: row.lead_id,
    tenantId: row.tenant_id,
    normalizedEmail: row.normalized_email,
    createdAt: row.created_at,
  } : null;
}

function observationFromRow(row: ObservationRow | null): LeadObservationReceipt | null {
  return row ? {
    observationReceiptId: row.observation_receipt_id,
    tenantId: row.tenant_id,
    leadId: row.lead_id,
    providerId: row.provider_id,
    sourceId: row.source_id,
    method: row.method,
    idempotencyKey: row.idempotency_key,
    observationDigest: row.observation_digest,
    observedAt: row.observed_at,
    recordedAt: row.recorded_at,
  } : null;
}

function parseReceipt(value: string | null): LeadTaskReceipt | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as LeadTaskReceipt;
    return parsed?.schemaVersion === 'lead_operator_receipt@1.0.0' ? parsed : null;
  } catch {
    return null;
  }
}

function taskFromRow(row: TaskRow | null): LeadLoopTask | null {
  return row ? {
    taskId: row.task_id,
    tenantId: row.tenant_id,
    idempotencyKey: row.idempotency_key,
    inputDigest: row.input_digest,
    status: row.status,
    claimId: row.claim_id,
    fencingToken: Number(row.fencing_token),
    leaseExpiresAt: row.lease_expires_at,
    receipt: parseReceipt(row.receipt_json),
    errorCode: row.error_code,
    stopReason: row.stop_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    terminalAt: row.terminal_at,
  } : null;
}

function reservationFromRow(row: ReservationRow | null): LeadSpendReservation | null {
  return row ? {
    reservationId: row.reservation_id,
    tenantId: row.tenant_id,
    taskId: row.task_id,
    providerId: row.provider_id,
    idempotencyKey: row.idempotency_key,
    unit: row.unit,
    reservedUnits: Number(row.reserved_units),
    settledUnits: row.settled_units === null ? null : Number(row.settled_units),
    status: row.status,
    createdAt: row.created_at,
    settledAt: row.settled_at,
  } : null;
}

function usageFromRow(row: UsageRow | null): LeadProviderUsage | null {
  return row ? {
    usageId: row.usage_id,
    tenantId: row.tenant_id,
    taskId: row.task_id,
    reservationId: row.reservation_id,
    providerId: row.provider_id,
    idempotencyKey: row.idempotency_key,
    unit: row.unit,
    usedUnits: Number(row.used_units),
    receiptDigest: row.receipt_digest,
    recordedAt: row.recorded_at,
  } : null;
}

function foldbackFromRow(row: FoldbackRow | null): LeadCortexFoldback | null {
  return row ? {
    foldbackId: row.foldback_id,
    tenantId: row.tenant_id,
    taskId: row.task_id,
    transformationVersion: row.transformation_version,
    leadsCaptured: Number(row.leads_captured),
    observationsRecorded: Number(row.observations_recorded),
    stagesCompleted: Number(row.stages_completed),
    spendUnits: Number(row.spend_units),
    completedAt: row.completed_at,
  } : null;
}

function sameObservation(a: LeadObservationReceipt, b: LeadObservationReceipt): boolean {
  return a.tenantId === b.tenantId && a.leadId === b.leadId
    && a.providerId === b.providerId && a.sourceId === b.sourceId
    && a.method === b.method && a.idempotencyKey === b.idempotencyKey
    && a.observationDigest === b.observationDigest && a.observedAt === b.observedAt;
}

function terminalClaim(row: TaskRow): ClaimLeadTaskResult {
  if (row.status === 'completed') {
    const receipt = parseReceipt(row.receipt_json);
    return receipt
      ? { status: 'terminal', state: 'completed', receipt: { ...receipt, replayed: true } }
      : { status: 'conflict', code: 'completed_receipt_invalid' };
  }
  if (row.status === 'failed') {
    return { status: 'terminal', state: 'failed', code: row.error_code ?? 'lead_task_failed' };
  }
  if (row.status === 'stopped') {
    return { status: 'terminal', state: 'stopped', code: row.stop_reason ?? 'lead_task_stopped' };
  }
  return { status: 'conflict', code: 'lead_task_not_terminal' };
}

export function d1LeadRuntimeStore(db: LeadD1DatabaseLike): LeadRuntimeStoreLike {
  async function readLead(tenantId: string, leadId: string): Promise<LeadRow | null> {
    return db.prepare(`
      SELECT lead_id, tenant_id, normalized_email, created_at
      FROM lead_records WHERE tenant_id = ? AND lead_id = ?
    `).bind(tenantId, leadId).first<LeadRow>();
  }

  async function readAlias(tenantId: string, providerId: string, sourceId: string): Promise<AliasRow | null> {
    return db.prepare(`
      SELECT a.alias_id, a.provider_id, a.source_id,
        l.lead_id, l.tenant_id, l.normalized_email, l.created_at
      FROM lead_source_aliases a
      JOIN lead_records l ON l.lead_id = a.lead_id AND l.tenant_id = a.tenant_id
      WHERE a.tenant_id = ? AND a.provider_id = ? AND a.source_id = ?
    `).bind(tenantId, providerId, sourceId).first<AliasRow>();
  }

  async function readTask(taskId: string): Promise<TaskRow | null> {
    return db.prepare(`SELECT * FROM lead_loop_tasks WHERE task_id = ?`)
      .bind(taskId).first<TaskRow>();
  }

  async function readReservationById(reservationId: string): Promise<ReservationRow | null> {
    return db.prepare(`SELECT * FROM lead_spend_reservations WHERE reservation_id = ?`)
      .bind(reservationId).first<ReservationRow>();
  }

  return {
    async captureLead(input) {
      if (![input.leadId, input.aliasId, input.tenantId, input.providerId, input.sourceId].every(validId)
          || !validTimestamp(input.observedAt)) {
        return { status: 'conflict', code: 'lead_identity_invalid' };
      }
      const normalizedEmail = normalizeEmail(input.normalizedEmail);
      if (input.normalizedEmail !== undefined && input.normalizedEmail !== null && normalizedEmail === undefined) {
        return { status: 'conflict', code: 'normalized_email_invalid' };
      }
      const alias = await readAlias(input.tenantId, input.providerId, input.sourceId);
      if (alias) {
        if (normalizedEmail !== undefined && normalizedEmail !== alias.normalized_email) {
          return { status: 'conflict', code: 'normalized_email_conflict' };
        }
        return { status: 'duplicate', lead: leadFromRow(alias)! };
      }
      const existingLead = await readLead(input.tenantId, input.leadId);
      if (existingLead) {
        if (normalizedEmail !== undefined && normalizedEmail !== existingLead.normalized_email) {
          return { status: 'conflict', code: 'normalized_email_conflict' };
        }
        try {
          const repaired = await db.prepare(`
            INSERT INTO lead_source_aliases (
              alias_id, tenant_id, lead_id, provider_id, source_id, first_observed_at
            ) VALUES (?, ?, ?, ?, ?, ?)
          `).bind(
            input.aliasId,
            input.tenantId,
            input.leadId,
            input.providerId,
            input.sourceId,
            input.observedAt,
          ).run();
          if (changes(repaired) !== 1) throw new Error('source_alias_repair_failed');
        } catch {
          const replay = await readAlias(input.tenantId, input.providerId, input.sourceId);
          if (!replay || replay.lead_id !== input.leadId
              || (normalizedEmail !== undefined && replay.normalized_email !== normalizedEmail)) {
            return { status: 'conflict', code: 'source_alias_conflict' };
          }
        }
        return { status: 'duplicate', lead: leadFromRow(existingLead)! };
      }
      if (normalizedEmail) {
        const emailOwner = await db.prepare(`
          SELECT lead_id, tenant_id, normalized_email, created_at
          FROM lead_records WHERE tenant_id = ? AND normalized_email = ?
        `).bind(input.tenantId, normalizedEmail).first<LeadRow>();
        if (emailOwner) return { status: 'conflict', code: 'normalized_email_conflict' };
      }
      try {
        const inserted = await db.prepare(`
          INSERT INTO lead_records (lead_id, tenant_id, normalized_email, created_at)
          VALUES (?, ?, ?, ?)
        `).bind(input.leadId, input.tenantId, normalizedEmail ?? null, input.observedAt).run();
        if (changes(inserted) !== 1) return { status: 'conflict', code: 'lead_insert_failed' };
      } catch {
        const replay = await readAlias(input.tenantId, input.providerId, input.sourceId);
        if (replay && (normalizedEmail === undefined || replay.normalized_email === normalizedEmail)) {
          return { status: 'duplicate', lead: leadFromRow(replay)! };
        }
        return { status: 'conflict', code: normalizedEmail ? 'normalized_email_conflict' : 'lead_identity_conflict' };
      }
      try {
        const inserted = await db.prepare(`
          INSERT INTO lead_source_aliases (
            alias_id, tenant_id, lead_id, provider_id, source_id, first_observed_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          input.aliasId,
          input.tenantId,
          input.leadId,
          input.providerId,
          input.sourceId,
          input.observedAt,
        ).run();
        if (changes(inserted) !== 1) throw new Error('source_alias_insert_failed');
      } catch {
        const replay = await readAlias(input.tenantId, input.providerId, input.sourceId);
        await db.prepare(`DELETE FROM lead_records WHERE tenant_id = ? AND lead_id = ?`)
          .bind(input.tenantId, input.leadId).run();
        if (replay && (normalizedEmail === undefined || replay.normalized_email === normalizedEmail)) {
          return { status: 'duplicate', lead: leadFromRow(replay)! };
        }
        return { status: 'conflict', code: 'source_alias_conflict' };
      }
      return {
        status: 'created',
        lead: {
          leadId: input.leadId,
          tenantId: input.tenantId,
          normalizedEmail: normalizedEmail ?? null,
          createdAt: input.observedAt,
        },
      };
    },

    async getLead(tenantId, leadId) {
      return leadFromRow(await readLead(tenantId, leadId));
    },

    async recordObservation(input) {
      if (![input.observationReceiptId, input.tenantId, input.leadId, input.providerId,
        input.sourceId, input.idempotencyKey].every(validId)
        || input.method !== 'GET' || !SHA256.test(input.observationDigest)
        || !validTimestamp(input.observedAt) || !validTimestamp(input.recordedAt)) {
        return { status: 'conflict', code: 'observation_receipt_invalid' };
      }
      const existing = await this.getObservation(input.tenantId, input.idempotencyKey);
      if (existing) {
        return sameObservation(existing, input)
          ? { status: 'duplicate', receipt: existing }
          : { status: 'conflict', code: 'observation_idempotency_conflict' };
      }
      const lead = await readLead(input.tenantId, input.leadId);
      if (!lead) return { status: 'conflict', code: 'observation_lead_not_found' };
      try {
        const result = await db.prepare(`
          INSERT INTO lead_observation_receipts (
            observation_receipt_id, tenant_id, lead_id, provider_id, source_id,
            method, idempotency_key, observation_digest, observed_at, recorded_at
          ) VALUES (?, ?, ?, ?, ?, 'GET', ?, ?, ?, ?)
        `).bind(
          input.observationReceiptId,
          input.tenantId,
          input.leadId,
          input.providerId,
          input.sourceId,
          input.idempotencyKey,
          input.observationDigest,
          input.observedAt,
          input.recordedAt,
        ).run();
        if (changes(result) !== 1) throw new Error('observation_insert_failed');
      } catch {
        const replay = await this.getObservation(input.tenantId, input.idempotencyKey);
        return replay && sameObservation(replay, input)
          ? { status: 'duplicate', receipt: replay }
          : { status: 'conflict', code: 'observation_receipt_conflict' };
      }
      return { status: 'recorded', receipt: input };
    },

    async getObservation(tenantId, idempotencyKey) {
      const row = await db.prepare(`
        SELECT * FROM lead_observation_receipts
        WHERE tenant_id = ? AND idempotency_key = ?
      `).bind(tenantId, idempotencyKey).first<ObservationRow>();
      return observationFromRow(row);
    },

    async createTask(input) {
      if (![input.taskId, input.tenantId, input.idempotencyKey].every(validId)
          || !SHA256.test(input.inputDigest) || !validTimestamp(input.createdAt)) {
        return { status: 'conflict', code: 'lead_task_invalid' };
      }
      let result;
      try {
        result = await db.prepare(`
          INSERT OR IGNORE INTO lead_loop_tasks (
            task_id, tenant_id, idempotency_key, input_digest,
            status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'pending', ?, ?)
        `).bind(
          input.taskId,
          input.tenantId,
          input.idempotencyKey,
          input.inputDigest,
          input.createdAt,
          input.createdAt,
        ).run();
      } catch {
        return { status: 'conflict', code: 'lead_task_insert_failed' };
      }
      const row = changes(result) === 1
        ? await readTask(input.taskId)
        : await db.prepare(`
            SELECT * FROM lead_loop_tasks WHERE tenant_id = ? AND idempotency_key = ?
          `).bind(input.tenantId, input.idempotencyKey).first<TaskRow>();
      const task = taskFromRow(row);
      if (!row || !task || row.input_digest !== input.inputDigest) {
        return { status: 'conflict', code: 'lead_task_idempotency_conflict' };
      }
      return { status: changes(result) === 1 ? 'pending' : 'duplicate', task };
    },

    async getTask(tenantId, taskId) {
      const row = await db.prepare(`
        SELECT * FROM lead_loop_tasks WHERE tenant_id = ? AND task_id = ?
      `).bind(tenantId, taskId).first<TaskRow>();
      return taskFromRow(row);
    },

    async claimTask(input) {
      if (![input.taskId, input.tenantId, input.claimId].every(validId)
          || !SHA256.test(input.inputDigest)
          || !validTimestamp(input.claimedAt) || !validTimestamp(input.leaseExpiresAt)
          || Date.parse(input.leaseExpiresAt) <= Date.parse(input.claimedAt)) {
        return { status: 'conflict', code: 'lead_task_claim_invalid' };
      }
      const current = await readTask(input.taskId);
      if (!current || current.tenant_id !== input.tenantId) {
        return { status: 'conflict', code: 'lead_task_not_found' };
      }
      if (current.input_digest !== input.inputDigest) {
        return { status: 'conflict', code: 'lead_task_identity_conflict' };
      }
      if (['completed', 'failed', 'stopped'].includes(current.status)) return terminalClaim(current);
      if (current.status === 'running') {
        const leaseMs = Date.parse(current.lease_expires_at ?? '');
        const claimMs = Date.parse(input.claimedAt);
        if (!Number.isFinite(leaseMs)) {
          return { status: 'conflict', code: 'lead_task_lease_invalid' };
        }
        if (leaseMs > claimMs) {
          return { status: 'busy', retryAfterMs: Math.max(0, leaseMs - claimMs) };
        }
        const result = await db.prepare(`
          UPDATE lead_loop_tasks
          SET claim_id = ?, fencing_token = fencing_token + 1,
            lease_expires_at = ?, updated_at = ?
          WHERE task_id = ? AND tenant_id = ? AND status = 'running'
            AND input_digest = ? AND fencing_token = ? AND lease_expires_at <= ?
        `).bind(
          input.claimId,
          input.leaseExpiresAt,
          input.claimedAt,
          input.taskId,
          input.tenantId,
          input.inputDigest,
          current.fencing_token,
          input.claimedAt,
        ).run();
        if (changes(result) !== 1) {
          const winner = await readTask(input.taskId);
          if (winner && ['completed', 'failed', 'stopped'].includes(winner.status)) return terminalClaim(winner);
          return { status: 'conflict', code: 'lead_task_claim_raced' };
        }
      } else {
        const result = await db.prepare(`
          UPDATE lead_loop_tasks
          SET status = 'running', claim_id = ?, fencing_token = fencing_token + 1,
            lease_expires_at = ?, updated_at = ?
          WHERE task_id = ? AND tenant_id = ? AND status = 'pending'
            AND input_digest = ? AND fencing_token = 0
        `).bind(
          input.claimId,
          input.leaseExpiresAt,
          input.claimedAt,
          input.taskId,
          input.tenantId,
          input.inputDigest,
        ).run();
        if (changes(result) !== 1) return { status: 'conflict', code: 'lead_task_claim_raced' };
      }
      const claimed = await readTask(input.taskId);
      if (!claimed || claimed.status !== 'running' || claimed.claim_id !== input.claimId
          || claimed.lease_expires_at !== input.leaseExpiresAt) {
        return { status: 'conflict', code: 'lead_task_claim_readback_failed' };
      }
      return {
        status: 'claimed',
        taskId: input.taskId,
        claimId: input.claimId,
        fencingToken: Number(claimed.fencing_token),
        leaseExpiresAt: input.leaseExpiresAt,
      };
    },

    async stopTask(input) {
      if (!validId(input.reason) || !validTimestamp(input.stoppedAt)) return 'conflict';
      const row = await readTask(input.taskId);
      if (row?.status === 'stopped') return 'replay';
      if (!row || row.status !== 'running') return 'conflict';
      const result = await db.prepare(`
        UPDATE lead_loop_tasks
        SET status = 'stopped', stop_reason = ?, updated_at = ?, terminal_at = ?
        WHERE task_id = ? AND status = 'running' AND claim_id = ? AND fencing_token = ?
      `).bind(
        input.reason,
        input.stoppedAt,
        input.stoppedAt,
        input.taskId,
        input.claimId,
        input.fencingToken,
      ).run();
      return changes(result) === 1 ? 'recorded' : 'conflict';
    },

    async completeTask(input) {
      if (!validTimestamp(input.completedAt)
          || input.receipt.schemaVersion !== 'lead_operator_receipt@1.0.0'
          || input.receipt.taskId !== input.taskId || input.receipt.state !== 'completed'
          || !validId(input.receipt.leadId)
          || ![input.receipt.observationCount, input.receipt.stagesCompleted,
            input.receipt.spendUnits].every(validUnits)
          || input.receipt.updatedAt !== input.completedAt) {
        return { status: 'conflict' };
      }
      const current = await readTask(input.taskId);
      if (current?.status === 'completed') {
        const receipt = parseReceipt(current.receipt_json);
        return receipt
          ? { status: 'replay', receipt: { ...receipt, replayed: true } }
          : { status: 'conflict' };
      }
      if (!current || current.status !== 'running') return { status: 'conflict' };
      const result = await db.prepare(`
        UPDATE lead_loop_tasks
        SET status = 'completed', receipt_json = ?, updated_at = ?, terminal_at = ?
        WHERE task_id = ? AND status = 'running' AND claim_id = ? AND fencing_token = ?
      `).bind(
        JSON.stringify({ ...input.receipt, replayed: false }),
        input.completedAt,
        input.completedAt,
        input.taskId,
        input.claimId,
        input.fencingToken,
      ).run();
      if (changes(result) !== 1) return { status: 'conflict' };
      return { status: 'recorded', receipt: { ...input.receipt, replayed: false } };
    },

    async failTask(input) {
      if (!validId(input.errorCode) || !validTimestamp(input.failedAt)) return 'conflict';
      const row = await readTask(input.taskId);
      if (row?.status === 'failed') return 'replay';
      if (!row || row.status !== 'running') return 'conflict';
      const result = await db.prepare(`
        UPDATE lead_loop_tasks
        SET status = 'failed', error_code = ?, updated_at = ?, terminal_at = ?
        WHERE task_id = ? AND status = 'running' AND claim_id = ? AND fencing_token = ?
      `).bind(
        input.errorCode,
        input.failedAt,
        input.failedAt,
        input.taskId,
        input.claimId,
        input.fencingToken,
      ).run();
      return changes(result) === 1 ? 'recorded' : 'conflict';
    },

    async reserveSpend(input) {
      if (![input.reservationId, input.tenantId, input.taskId, input.providerId,
        input.idempotencyKey].every(validId)
        || !validUnits(input.reservedUnits) || !validTimestamp(input.createdAt)) {
        return { status: 'conflict', code: 'spend_reservation_invalid' };
      }
      const task = await readTask(input.taskId);
      if (!task || task.tenant_id !== input.tenantId) {
        return { status: 'conflict', code: 'spend_task_not_found' };
      }
      let result;
      try {
        result = await db.prepare(`
          INSERT OR IGNORE INTO lead_spend_reservations (
            reservation_id, tenant_id, task_id, provider_id, idempotency_key,
            unit, reserved_units, status, created_at
          ) VALUES (?, ?, ?, ?, ?, 'usd_micros', ?, 'reserved', ?)
        `).bind(
          input.reservationId,
          input.tenantId,
          input.taskId,
          input.providerId,
          input.idempotencyKey,
          input.reservedUnits,
          input.createdAt,
        ).run();
      } catch {
        return { status: 'conflict', code: 'spend_reservation_insert_failed' };
      }
      const row = changes(result) === 1
        ? await readReservationById(input.reservationId)
        : await db.prepare(`
            SELECT * FROM lead_spend_reservations WHERE tenant_id = ? AND idempotency_key = ?
          `).bind(input.tenantId, input.idempotencyKey).first<ReservationRow>();
      const reservation = reservationFromRow(row);
      if (!row || !reservation || row.task_id !== input.taskId || row.provider_id !== input.providerId
          || Number(row.reserved_units) !== input.reservedUnits) {
        return { status: 'conflict', code: 'spend_reservation_idempotency_conflict' };
      }
      return { status: changes(result) === 1 ? 'reserved' : 'duplicate', reservation };
    },

    async getSpendReservation(tenantId, idempotencyKey) {
      const row = await db.prepare(`
        SELECT * FROM lead_spend_reservations WHERE tenant_id = ? AND idempotency_key = ?
      `).bind(tenantId, idempotencyKey).first<ReservationRow>();
      return reservationFromRow(row);
    },

    async settleUsage(input) {
      if (![input.usageId, input.tenantId, input.taskId, input.reservationId,
        input.providerId, input.idempotencyKey].every(validId)
        || !validUnits(input.usedUnits) || !SHA256.test(input.receiptDigest)
        || !validTimestamp(input.recordedAt)) {
        return { status: 'conflict', code: 'provider_usage_invalid' };
      }
      const existing = await this.getProviderUsage(input.tenantId, input.idempotencyKey);
      if (existing) {
        const same = existing.taskId === input.taskId && existing.reservationId === input.reservationId
          && existing.providerId === input.providerId && existing.usedUnits === input.usedUnits
          && existing.receiptDigest === input.receiptDigest;
        return same
          ? { status: 'duplicate', usage: existing }
          : { status: 'conflict', code: 'provider_usage_idempotency_conflict' };
      }
      const reservation = await readReservationById(input.reservationId);
      if (!reservation || reservation.tenant_id !== input.tenantId
          || reservation.task_id !== input.taskId || reservation.provider_id !== input.providerId) {
        return { status: 'conflict', code: 'provider_usage_reservation_not_found' };
      }
      if (reservation.status !== 'reserved' || input.usedUnits > Number(reservation.reserved_units)) {
        return { status: 'conflict', code: 'provider_usage_exceeds_reservation' };
      }
      try {
        const result = await db.prepare(`
          INSERT INTO lead_provider_usage (
            usage_id, tenant_id, task_id, reservation_id, provider_id,
            idempotency_key, unit, used_units, receipt_digest, recorded_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'usd_micros', ?, ?, ?)
        `).bind(
          input.usageId,
          input.tenantId,
          input.taskId,
          input.reservationId,
          input.providerId,
          input.idempotencyKey,
          input.usedUnits,
          input.receiptDigest,
          input.recordedAt,
        ).run();
        if (changes(result) !== 1) throw new Error('provider_usage_insert_failed');
      } catch {
        const replay = await this.getProviderUsage(input.tenantId, input.idempotencyKey);
        return replay && replay.reservationId === input.reservationId
          && replay.usedUnits === input.usedUnits && replay.receiptDigest === input.receiptDigest
          ? { status: 'duplicate', usage: replay }
          : { status: 'conflict', code: 'provider_usage_conflict' };
      }
      return {
        status: 'recorded',
        usage: {
          usageId: input.usageId,
          tenantId: input.tenantId,
          taskId: input.taskId,
          reservationId: input.reservationId,
          providerId: input.providerId,
          idempotencyKey: input.idempotencyKey,
          unit: 'usd_micros',
          usedUnits: input.usedUnits,
          receiptDigest: input.receiptDigest,
          recordedAt: input.recordedAt,
        },
      };
    },

    async getProviderUsage(tenantId, idempotencyKey) {
      const row = await db.prepare(`
        SELECT * FROM lead_provider_usage WHERE tenant_id = ? AND idempotency_key = ?
      `).bind(tenantId, idempotencyKey).first<UsageRow>();
      return usageFromRow(row);
    },

    async recordFoldback(input) {
      if (Object.keys(input).sort().join(',') !== 'foldbackId,taskId,tenantId'
          || ![input.foldbackId, input.tenantId, input.taskId].every(validId)) return 'conflict';
      const task = await readTask(input.taskId);
      if (!task || task.tenant_id !== input.tenantId || task.status !== 'completed') return 'conflict';
      const receipt = parseReceipt(task.receipt_json);
      if (!receipt
          || receipt.taskId !== input.taskId
          || !validId(receipt.leadId)
          || ![receipt.observationCount, receipt.stagesCompleted, receipt.spendUnits].every(validUnits)
          || !validTimestamp(receipt.updatedAt)) return 'conflict';
      const derived: LeadCortexFoldback = {
        foldbackId: input.foldbackId,
        tenantId: input.tenantId,
        taskId: input.taskId,
        transformationVersion: 'lead-runtime-derived-v1',
        leadsCaptured: 1,
        observationsRecorded: receipt.observationCount,
        stagesCompleted: receipt.stagesCompleted,
        spendUnits: receipt.spendUnits,
        completedAt: receipt.updatedAt,
      };
      let result;
      try {
        result = await db.prepare(`
          INSERT OR IGNORE INTO lead_cortex_foldbacks (
            foldback_id, tenant_id, task_id, transformation_version,
            leads_captured, observations_recorded, stages_completed, spend_units, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
          derived.foldbackId,
          derived.tenantId,
          derived.taskId,
          derived.transformationVersion,
          derived.leadsCaptured,
          derived.observationsRecorded,
          derived.stagesCompleted,
          derived.spendUnits,
          derived.completedAt,
        ).run();
      } catch {
        return 'conflict';
      }
      if (changes(result) === 1) return 'recorded';
      const existing = await this.getFoldback(input.tenantId, input.taskId);
      return existing
        && existing.tenantId === derived.tenantId
        && existing.transformationVersion === derived.transformationVersion
        && existing.leadsCaptured === derived.leadsCaptured
        && existing.observationsRecorded === derived.observationsRecorded
        && existing.stagesCompleted === derived.stagesCompleted
        && existing.spendUnits === derived.spendUnits
        && existing.completedAt === derived.completedAt
        ? 'duplicate'
        : 'conflict';
    },

    async getFoldback(tenantId, taskId) {
      const row = await db.prepare(`
        SELECT * FROM lead_cortex_foldbacks WHERE tenant_id = ? AND task_id = ?
      `).bind(tenantId, taskId).first<FoldbackRow>();
      return foldbackFromRow(row);
    },
  };
}

import type {
  IVerifExpleeObserver,
  IVerifInboxContact,
  IVerifInboxObservation,
  IVerifThreadObservation,
} from './iverif-explee.ts';
import type {
  LeadRuntimeStoreLike,
  LeadTaskReceipt,
} from './lead-runtime-store.ts';

const MAX_STAGE_COUNT = 16;
const MAX_DEPENDENCIES = 8;
const STAGE_ID = /^[a-z][a-z0-9-]{0,63}$/;
const IVERIF_PROVIDER_ID = 'explee-public-api';
const LEASE_MS = 5 * 60 * 1_000;

export interface LeadStageDefinition<T = unknown> {
  id: string;
  dependsOn?: readonly string[];
  metered?: boolean;
  reservationId?: string;
  execute(): Promise<T>;
}

export type LeadStageExecution<T = unknown> =
  | { status: 'completed'; value: T }
  | { status: 'failed'; code: string }
  | { status: 'blocked'; code: 'dependency_not_completed'; dependencies: string[] }
  | { status: 'stopped'; code: 'stop_rule_matched' };

export interface LeadStageExecutionResult {
  order: string[];
  stages: Record<string, LeadStageExecution>;
}

export interface RunIverifCaptureEnrichArgs {
  tenantId: string;
  idempotencyKey: string;
  observer: Pick<IVerifExpleeObserver, 'getNeedReplyInbox' | 'getThread'>;
  store: LeadRuntimeStoreLike;
  now: () => string;
  uuid: () => string;
  shouldStop?: (input: { taskId: string; nextStage: 'capture' | 'enrich' }) => boolean | Promise<boolean>;
}

export type RunIverifCaptureEnrichResult =
  | { status: 'completed' | 'replay'; receipt: LeadTaskReceipt }
  | { status: 'busy'; retryAfterMs: number }
  | { status: 'stopped'; code: string }
  | { status: 'failed' | 'conflict'; code: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (!isRecord(value)) return JSON.stringify(value);
  return `{${Object.keys(value).sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

async function sha256(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(canonicalJson(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function errorCode(error: unknown): string {
  if (isRecord(error) && typeof error.code === 'string' && /^[a-z][a-z0-9_]{1,63}$/.test(error.code)) {
    return error.code;
  }
  if (error instanceof Error && /^[a-z][a-z0-9_]{1,63}$/.test(error.message)) return error.message;
  return 'lead_stage_failed';
}

function fail(code: string): never {
  const error = new Error(code) as Error & { code: string };
  error.code = code;
  throw error;
}

export function validateLeadStageDag(stages: readonly LeadStageDefinition[]): string[] {
  if (!Array.isArray(stages) || stages.length === 0 || stages.length > MAX_STAGE_COUNT) {
    throw new Error('lead_stage_graph_size_invalid');
  }
  const byId = new Map<string, LeadStageDefinition>();
  const position = new Map<string, number>();
  for (const [index, stage] of stages.entries()) {
    if (!stage || !STAGE_ID.test(stage.id) || typeof stage.execute !== 'function') {
      throw new Error('lead_stage_invalid');
    }
    if (byId.has(stage.id)) throw new Error('lead_stage_duplicate');
    const dependencies = stage.dependsOn ?? [];
    if (!Array.isArray(dependencies) || dependencies.length > MAX_DEPENDENCIES
        || new Set(dependencies).size !== dependencies.length) {
      throw new Error('lead_stage_dependencies_invalid');
    }
    byId.set(stage.id, stage);
    position.set(stage.id, index);
  }
  const indegree = new Map<string, number>();
  const downstream = new Map<string, string[]>();
  for (const stage of stages) {
    indegree.set(stage.id, stage.dependsOn?.length ?? 0);
    for (const dependency of stage.dependsOn ?? []) {
      if (dependency === stage.id || !byId.has(dependency)) {
        throw new Error('lead_stage_dependency_missing');
      }
      downstream.set(dependency, [...(downstream.get(dependency) ?? []), stage.id]);
    }
  }
  const ready = stages.filter((stage) => indegree.get(stage.id) === 0).map((stage) => stage.id);
  const order: string[] = [];
  while (ready.length > 0) {
    ready.sort((a, b) => position.get(a)! - position.get(b)!);
    const id = ready.shift()!;
    order.push(id);
    for (const child of downstream.get(id) ?? []) {
      const next = indegree.get(child)! - 1;
      indegree.set(child, next);
      if (next === 0) ready.push(child);
    }
  }
  if (order.length !== stages.length) throw new Error('lead_stage_cycle');
  return order;
}

export async function executeLeadStages({
  stages,
  shouldStop,
}: {
  stages: readonly LeadStageDefinition[];
  shouldStop?: (stage: LeadStageDefinition) => boolean | Promise<boolean>;
}): Promise<LeadStageExecutionResult> {
  const order = validateLeadStageDag(stages);
  const byId = new Map(stages.map((stage) => [stage.id, stage]));
  const results: Record<string, LeadStageExecution> = {};
  for (const id of order) {
    const stage = byId.get(id)!;
    const blockedBy = (stage.dependsOn ?? []).filter((dependency) => results[dependency]?.status !== 'completed');
    if (blockedBy.length > 0) {
      results[id] = {
        status: 'blocked',
        code: 'dependency_not_completed',
        dependencies: blockedBy,
      };
      continue;
    }
    if (await shouldStop?.(stage)) {
      results[id] = { status: 'stopped', code: 'stop_rule_matched' };
      continue;
    }
    if (stage.metered && !stage.reservationId) {
      results[id] = { status: 'failed', code: 'spend_reservation_required' };
      continue;
    }
    try {
      results[id] = { status: 'completed', value: await stage.execute() };
    } catch (error) {
      results[id] = { status: 'failed', code: errorCode(error) };
    }
  }
  return { order, stages: results };
}

function pickOneContact(inbox: IVerifInboxObservation): IVerifInboxContact | null {
  return [...inbox.contacts]
    .sort((a, b) => (a.personId < b.personId ? -1 : a.personId > b.personId ? 1 : 0))[0] ?? null;
}

function nextTimestamp(value: string, offsetMs: number): string | null {
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? new Date(milliseconds + offsetMs).toISOString() : null;
}

async function ensureDerivedFoldback({
  tenantId,
  store,
  receipt,
  foldbackId,
}: {
  tenantId: string;
  store: LeadRuntimeStoreLike;
  receipt: LeadTaskReceipt;
  foldbackId: string;
}): Promise<boolean> {
  const result = await store.recordFoldback({
    foldbackId,
    tenantId,
    taskId: receipt.taskId,
  });
  return result !== 'conflict';
}

export async function runIverifCaptureEnrich({
  tenantId,
  idempotencyKey,
  observer,
  store,
  now,
  uuid,
  shouldStop,
}: RunIverifCaptureEnrichArgs): Promise<RunIverifCaptureEnrichResult> {
  const inputDigest = await sha256({
    schemaVersion: 'iverif_capture_enrich@1.0.0',
    tenantId,
    providerId: IVERIF_PROVIDER_ID,
    mode: 'GET-only',
  });
  const createdAt = now();
  const created = await store.createTask({
    taskId: uuid(),
    tenantId,
    idempotencyKey,
    inputDigest,
    createdAt,
  });
  if (created.status === 'conflict') return { status: 'conflict', code: created.code };
  const taskId = created.task.taskId;
  const claimedAt = now();
  const leaseExpiresAt = nextTimestamp(claimedAt, LEASE_MS);
  if (!leaseExpiresAt) return { status: 'conflict', code: 'lead_task_time_invalid' };
  const claim = await store.claimTask({
    taskId,
    tenantId,
    inputDigest,
    claimId: uuid(),
    claimedAt,
    leaseExpiresAt,
  });
  if (claim.status === 'terminal') {
    if (claim.state === 'completed') {
      const foldbackReady = await ensureDerivedFoldback({
        tenantId,
        store,
        receipt: claim.receipt,
        foldbackId: uuid(),
      });
      return foldbackReady
        ? { status: 'replay', receipt: claim.receipt }
        : { status: 'conflict', code: 'cortex_foldback_conflict' };
    }
    return { status: claim.state === 'stopped' ? 'stopped' : 'failed', code: claim.code };
  }
  if (claim.status === 'busy') return claim;
  if (claim.status === 'conflict') return { status: 'conflict', code: claim.code };

  const reservation = await store.reserveSpend({
    reservationId: uuid(),
    tenantId,
    taskId,
    providerId: IVERIF_PROVIDER_ID,
    idempotencyKey: `${idempotencyKey}:spend`,
    reservedUnits: 0,
    createdAt: now(),
  });
  if (reservation.status === 'conflict') {
    await store.failTask({
      taskId,
      claimId: claim.claimId,
      fencingToken: claim.fencingToken,
      errorCode: reservation.code,
      failedAt: now(),
    });
    return { status: 'conflict', code: reservation.code };
  }

  const observationKey = `${idempotencyKey}:observation`;
  const priorObservation = await store.getObservation(tenantId, observationKey);
  if (claim.fencingToken > 1 && !priorObservation) {
    const code = 'lead_run_reconciliation_required';
    await store.failTask({
      taskId,
      claimId: claim.claimId,
      fencingToken: claim.fencingToken,
      errorCode: code,
      failedAt: now(),
    });
    return { status: 'failed', code };
  }

  let leadId = priorObservation?.leadId ?? null;
  let observationDigest = priorObservation?.observationDigest ?? null;
  if (priorObservation
      && (priorObservation.providerId !== IVERIF_PROVIDER_ID || priorObservation.method !== 'GET')) {
    return { status: 'conflict', code: 'observation_reconciliation_conflict' };
  }

  if (!priorObservation) {
    let inbox: IVerifInboxObservation | null = null;
    let selected: IVerifInboxContact | null = null;
    let thread: IVerifThreadObservation | null = null;
    const execution = await executeLeadStages({
      stages: [
        {
          id: 'capture',
          metered: true,
          reservationId: reservation.reservation.reservationId,
          async execute() {
            inbox = await observer.getNeedReplyInbox();
            selected = pickOneContact(inbox);
            if (!selected) fail('iverif_inbox_empty');
            const identityDigest = await sha256({
              tenantId,
              providerId: IVERIF_PROVIDER_ID,
              sourceId: selected.personId,
            });
            const captured = await store.captureLead({
              leadId: `lead_${identityDigest.slice(0, 48)}`,
              aliasId: `alias_${identityDigest.slice(0, 48)}`,
              tenantId,
              providerId: IVERIF_PROVIDER_ID,
              sourceId: selected.personId,
              observedAt: inbox.source.observedAt,
            });
            if (captured.status === 'conflict') fail(captured.code);
            leadId = captured.lead.leadId;
            return { leadId, personId: selected.personId };
          },
        },
        {
          id: 'enrich',
          dependsOn: ['capture'],
          metered: true,
          reservationId: reservation.reservation.reservationId,
          async execute() {
            if (!selected) fail('iverif_capture_missing');
            thread = await observer.getThread(selected.personId);
            if (thread.personId !== selected.personId) fail('iverif_person_identity_conflict');
            return { personId: thread.personId, messageCount: thread.messageCount };
          },
        },
      ],
      shouldStop: async (stage) => shouldStop?.({
        taskId,
        nextStage: stage.id as 'capture' | 'enrich',
      }) ?? false,
    });
    const stopped = execution.order.find((stageId) => execution.stages[stageId].status === 'stopped');
    if (stopped) {
      await store.stopTask({
        taskId,
        claimId: claim.claimId,
        fencingToken: claim.fencingToken,
        reason: `stop_before_${stopped}`,
        stoppedAt: now(),
      });
      return { status: 'stopped', code: `stop_before_${stopped}` };
    }
    const failed = execution.order.find((stageId) => execution.stages[stageId].status === 'failed');
    if (failed) {
      const stage = execution.stages[failed];
      const code = stage.status === 'failed' ? stage.code : 'lead_stage_failed';
      await store.failTask({
        taskId,
        claimId: claim.claimId,
        fencingToken: claim.fencingToken,
        errorCode: code,
        failedAt: now(),
      });
      return { status: 'failed', code };
    }
    if (!inbox || !selected || !thread || !leadId) {
      await store.failTask({
        taskId,
        claimId: claim.claimId,
        fencingToken: claim.fencingToken,
        errorCode: 'iverif_stage_projection_missing',
        failedAt: now(),
      });
      return { status: 'failed', code: 'iverif_stage_projection_missing' };
    }

    observationDigest = await sha256({
      provider: IVERIF_PROVIDER_ID,
      sourceId: selected.personId,
      inbox: {
        tab: inbox.tab,
        total: inbox.total,
        omittedContacts: inbox.omittedContacts,
        pageCount: inbox.pageCount,
        truncated: inbox.truncated,
        selected: {
          latestIntent: selected.latestIntent,
          sentCount: selected.sentCount,
          replyCount: selected.replyCount,
          latestSentAt: selected.latestSentAt,
          latestReplyAt: selected.latestReplyAt,
        },
      },
      thread,
    });
    const observation = await store.recordObservation({
      observationReceiptId: uuid(),
      tenantId,
      leadId,
      providerId: IVERIF_PROVIDER_ID,
      sourceId: selected.personId,
      method: 'GET',
      idempotencyKey: observationKey,
      observationDigest,
      observedAt: inbox.source.observedAt,
      recordedAt: now(),
    });
    if (observation.status === 'conflict') {
      await store.failTask({
        taskId,
        claimId: claim.claimId,
        fencingToken: claim.fencingToken,
        errorCode: observation.code,
        failedAt: now(),
      });
      return { status: 'conflict', code: observation.code };
    }
    leadId = observation.receipt.leadId;
    observationDigest = observation.receipt.observationDigest;
  }

  if (!leadId || !observationDigest) {
    return { status: 'conflict', code: 'observation_reconciliation_conflict' };
  }

  const usage = await store.settleUsage({
    usageId: uuid(),
    tenantId,
    taskId,
    reservationId: reservation.reservation.reservationId,
    providerId: IVERIF_PROVIDER_ID,
    idempotencyKey: `${idempotencyKey}:usage`,
    usedUnits: 0,
    receiptDigest: observationDigest,
    recordedAt: now(),
  });
  if (usage.status === 'conflict') {
    await store.failTask({
      taskId,
      claimId: claim.claimId,
      fencingToken: claim.fencingToken,
      errorCode: usage.code,
      failedAt: now(),
    });
    return { status: 'conflict', code: usage.code };
  }

  const completedAt = now();
  const receipt: LeadTaskReceipt = {
    schemaVersion: 'lead_operator_receipt@1.0.0',
    taskId,
    state: 'completed',
    leadId,
    observationCount: 1,
    stagesCompleted: 2,
    spendUnits: 0,
    replayed: false,
    updatedAt: completedAt,
  };
  const completed = await store.completeTask({
    taskId,
    claimId: claim.claimId,
    fencingToken: claim.fencingToken,
    receipt,
    completedAt,
  });
  if (completed.status === 'conflict') {
    return { status: 'conflict', code: 'lead_task_completion_conflict' };
  }
  const foldbackReady = await ensureDerivedFoldback({
    tenantId,
    store,
    receipt: completed.receipt,
    foldbackId: uuid(),
  });
  return foldbackReady
    ? { status: completed.status === 'replay' ? 'replay' : 'completed', receipt: completed.receipt }
    : { status: 'conflict', code: 'cortex_foldback_conflict' };
}

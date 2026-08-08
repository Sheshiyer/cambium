import type { R2BucketLike } from './context-bindings.ts';
import type { FabricEdge, FabricNode } from './mission-fabric.ts';
import { PORTFOLIO_CATALOG } from './portfolio-catalog.ts';

export const HERMES_EXECUTION_FOLDBACK_SCHEMA = 'thoughtseed.hermes.execution-foldback.v1' as const;

const TEXT = new TextEncoder();
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,159}$/;
const WORK_ID = /^(sapling|branch|program):[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256_REF = /^sha256:[0-9a-f]{64}$/;
const CATALOG_WORK_IDS = new Set(PORTFOLIO_CATALOG.records.map((record) => record.workId));

export interface HermesExecutionFoldbackInput {
  schema: typeof HERMES_EXECUTION_FOLDBACK_SCHEMA;
  tenantId: string;
  graphVersion: number;
  goalGraph: {
    nodeId: string;
    taskId: string;
    workObjectId: string;
    workObjectKind: 'sapling' | 'branch' | 'program';
    pinnedLoadoutId: string;
  };
  execution: {
    memberId: string;
    directiveId: string;
    idempotencyKey: string;
    executionId: string;
    claimId: string;
    fencingToken: string;
    attempt: number;
    status: 'executed' | 'failed';
    attestationId: string;
    inputDigest: string;
    terminalProofDigest: string;
    recordedAt: string;
  };
}

export interface HermesExecutionFoldbackReceipt extends HermesExecutionFoldbackInput {
  receiptId: string;
  contentDigest: string;
  r2Key: string;
  status: 'prepared';
}

export interface HermesExecutionFoldbackProjection {
  receipt: HermesExecutionFoldbackReceipt;
  node: FabricNode;
  edges: readonly FabricEdge[];
}

export interface HermesExecutionFoldbackStoreLike {
  record(receipt: HermesExecutionFoldbackReceipt): Promise<{ duplicate: boolean }>;
}

export class HermesExecutionFoldbackValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HermesExecutionFoldbackValidationError';
  }
}

export class HermesExecutionFoldbackConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HermesExecutionFoldbackConflictError';
  }
}

export class HermesExecutionFoldbackStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'HermesExecutionFoldbackStorageError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactFields(value: Record<string, unknown>, fields: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...fields].sort();
  if (actual.length !== expected.length || actual.some((field, index) => field !== expected[index])) {
    throw new HermesExecutionFoldbackValidationError(`${label} fields are invalid`);
  }
}

function safeText(value: unknown, field: string): string {
  if (typeof value !== 'string' || !SAFE_ID.test(value)) {
    throw new HermesExecutionFoldbackValidationError(`${field} is invalid`);
  }
  return value;
}

function digest(value: unknown, field: string): string {
  if (typeof value !== 'string' || !SHA256_REF.test(value)) {
    throw new HermesExecutionFoldbackValidationError(`${field} is invalid`);
  }
  return value;
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
}

export function canonicalHermesFoldbackJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

async function sha256(value: string): Promise<string> {
  const result = await crypto.subtle.digest('SHA-256', TEXT.encode(value) as unknown as BufferSource);
  return [...new Uint8Array(result)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function validateInput(raw: unknown): HermesExecutionFoldbackInput {
  if (!isRecord(raw)) throw new HermesExecutionFoldbackValidationError('foldback input must be an object');
  exactFields(raw, ['schema', 'tenantId', 'graphVersion', 'goalGraph', 'execution'], 'foldback input');
  if (raw.schema !== HERMES_EXECUTION_FOLDBACK_SCHEMA) throw new HermesExecutionFoldbackValidationError('foldback schema is invalid');
  const tenantId = safeText(raw.tenantId, 'tenantId');
  if (!Number.isSafeInteger(raw.graphVersion) || Number(raw.graphVersion) < 1) {
    throw new HermesExecutionFoldbackValidationError('graphVersion is invalid');
  }
  if (!isRecord(raw.goalGraph)) throw new HermesExecutionFoldbackValidationError('goalGraph must be an object');
  exactFields(raw.goalGraph, ['nodeId', 'taskId', 'workObjectId', 'workObjectKind', 'pinnedLoadoutId'], 'goalGraph');
  const nodeId = safeText(raw.goalGraph.nodeId, 'goalGraph.nodeId');
  const taskId = safeText(raw.goalGraph.taskId, 'goalGraph.taskId');
  const workObjectId = safeText(raw.goalGraph.workObjectId, 'goalGraph.workObjectId');
  const workObjectKind = raw.goalGraph.workObjectKind;
  const match = WORK_ID.exec(workObjectId);
  if (!match || match[1] !== workObjectKind || !CATALOG_WORK_IDS.has(workObjectId)) {
    throw new HermesExecutionFoldbackValidationError('Goal Graph WorkObject anchor is invalid');
  }
  const pinnedLoadoutId = safeText(raw.goalGraph.pinnedLoadoutId, 'goalGraph.pinnedLoadoutId');
  if (!isRecord(raw.execution)) throw new HermesExecutionFoldbackValidationError('execution must be an object');
  exactFields(raw.execution, [
    'memberId', 'directiveId', 'idempotencyKey', 'executionId', 'claimId', 'fencingToken', 'attempt',
    'status', 'attestationId', 'inputDigest', 'terminalProofDigest', 'recordedAt',
  ], 'execution');
  const status = raw.execution.status;
  if (status !== 'executed' && status !== 'failed') {
    throw new HermesExecutionFoldbackValidationError('foldback requires a terminal execution outcome');
  }
  const recordedAt = typeof raw.execution.recordedAt === 'string' ? raw.execution.recordedAt : '';
  if (!Number.isFinite(Date.parse(recordedAt)) || new Date(recordedAt).toISOString() !== recordedAt) {
    throw new HermesExecutionFoldbackValidationError('execution.recordedAt is invalid');
  }
  if (!Number.isSafeInteger(raw.execution.attempt) || Number(raw.execution.attempt) < 1) {
    throw new HermesExecutionFoldbackValidationError('execution.attempt is invalid');
  }
  return {
    schema: HERMES_EXECUTION_FOLDBACK_SCHEMA,
    tenantId,
    graphVersion: Number(raw.graphVersion),
    goalGraph: {
      nodeId,
      taskId,
      workObjectId,
      workObjectKind: workObjectKind as HermesExecutionFoldbackInput['goalGraph']['workObjectKind'],
      pinnedLoadoutId,
    },
    execution: {
      memberId: safeText(raw.execution.memberId, 'execution.memberId'),
      directiveId: safeText(raw.execution.directiveId, 'execution.directiveId'),
      idempotencyKey: safeText(raw.execution.idempotencyKey, 'execution.idempotencyKey'),
      executionId: safeText(raw.execution.executionId, 'execution.executionId'),
      claimId: safeText(raw.execution.claimId, 'execution.claimId'),
      fencingToken: safeText(raw.execution.fencingToken, 'execution.fencingToken'),
      attempt: Number(raw.execution.attempt),
      status,
      attestationId: safeText(raw.execution.attestationId, 'execution.attestationId'),
      inputDigest: digest(raw.execution.inputDigest, 'execution.inputDigest'),
      terminalProofDigest: digest(raw.execution.terminalProofDigest, 'execution.terminalProofDigest'),
      recordedAt,
    },
  };
}

export async function adaptHermesExecutionFoldback(raw: unknown): Promise<HermesExecutionFoldbackProjection> {
  const input = validateInput(raw);
  const contentDigestHex = await sha256(canonicalHermesFoldbackJson(input));
  const receiptId = `hfb_${contentDigestHex.slice(0, 24)}`;
  const receipt: HermesExecutionFoldbackReceipt = {
    ...input,
    receiptId,
    contentDigest: `sha256:${contentDigestHex}`,
    r2Key: `portfolio/thoughtseed/workobjects/${input.goalGraph.workObjectId}/foldback/${input.execution.executionId}.json`,
    status: 'prepared',
  };
  const node: FabricNode = {
    kind: 'receipt',
    value: {
      receiptId,
      runId: input.execution.executionId,
      taskId: input.goalGraph.taskId,
      graphVersion: input.graphVersion,
      status: input.execution.status === 'executed' ? 'complete' : 'failed',
      inputDigest: input.execution.inputDigest,
      outputDigest: input.execution.status === 'executed' ? input.execution.terminalProofDigest : null,
      evidenceRefs: [
        `goal-graph:${input.goalGraph.nodeId}`,
        `hermes-attestation:${input.execution.attestationId}`,
        input.execution.terminalProofDigest,
      ],
      approvalRef: null,
      createdAt: input.execution.recordedAt,
    },
  };
  return {
    receipt,
    node,
    edges: [
      { kind: 'proves', fromId: receiptId, toId: input.goalGraph.taskId },
      { kind: 'informs-next-intent', fromId: receiptId, toId: input.goalGraph.workObjectId },
    ],
  };
}

export async function validateHermesExecutionFoldbackReceipt(raw: unknown): Promise<HermesExecutionFoldbackReceipt> {
  if (!isRecord(raw)) throw new HermesExecutionFoldbackValidationError('foldback receipt must be an object');
  exactFields(raw, [
    'schema', 'tenantId', 'graphVersion', 'goalGraph', 'execution', 'receiptId', 'contentDigest', 'r2Key', 'status',
  ], 'foldback receipt');
  const {
    receiptId: _receiptId,
    contentDigest: _contentDigest,
    r2Key: _r2Key,
    status: _status,
    ...input
  } = raw;
  const expected = (await adaptHermesExecutionFoldback(input)).receipt;
  if (canonicalHermesFoldbackJson(raw) !== canonicalHermesFoldbackJson(expected)) {
    throw new HermesExecutionFoldbackValidationError('foldback receipt derivation is invalid');
  }
  return expected;
}

export function createHermesExecutionFoldbackStore(bucket: R2BucketLike): HermesExecutionFoldbackStoreLike {
  if (!bucket.put) throw new HermesExecutionFoldbackStorageError('foldback R2 binding is not writable');
  return {
    async record(receipt) {
      const validated = await validateHermesExecutionFoldbackReceipt(receipt);
      const body = canonicalHermesFoldbackJson(validated);
      const existing = await bucket.get(validated.r2Key);
      if (existing) {
        if (await existing.text() !== body) throw new HermesExecutionFoldbackConflictError('foldback outcome conflict');
        return { duplicate: true };
      }
      let stored;
      try {
        stored = await bucket.put!(validated.r2Key, TEXT.encode(body), {
          onlyIf: { etagDoesNotMatch: '*' },
          httpMetadata: { contentType: 'application/json' },
          customMetadata: { schema: HERMES_EXECUTION_FOLDBACK_SCHEMA, receiptId: validated.receiptId },
        });
      } catch {
        const winner = await bucket.get(validated.r2Key);
        if (!winner) throw new HermesExecutionFoldbackStorageError('foldback R2 write failed');
        if (await winner.text() !== body) throw new HermesExecutionFoldbackConflictError('foldback outcome conflict');
        return { duplicate: true };
      }
      if (stored) return { duplicate: false };
      const winner = await bucket.get(validated.r2Key);
      if (!winner) throw new HermesExecutionFoldbackStorageError('foldback write was not confirmed');
      if (await winner.text() !== body) throw new HermesExecutionFoldbackConflictError('foldback outcome conflict');
      return { duplicate: true };
    },
  };
}

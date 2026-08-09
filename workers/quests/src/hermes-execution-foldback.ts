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
  /**
   * Admission evidence is optional only to preserve v1 receipt compatibility.
   * When present it is a closed, exact binding to the terminal execution; an
   * unissued, stale, or substituted activation is never folded back.
   */
  activation?: {
    activationId: string;
    activationDigest: string;
    mappingReceiptId: string;
    mappingReceiptDigest: string;
    issued: true;
    staleFence: false;
    workObjectId: string;
    taskId: string;
    pinnedLoadoutId: string;
    fencingToken: string;
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
  /** Present only when issued, exact activation evidence admits foldback. */
  cortex?: HermesExecutionFoldbackCortexProjection;
  /** Present only when issued, exact activation evidence admits foldback. */
  agentMemory?: HermesExecutionFoldbackAgentMemoryProjection;
  /** Present only when issued, exact activation evidence admits foldback. */
  nextIntent?: HermesExecutionFoldbackNextIntentProposal;
  node: FabricNode;
  edges: readonly FabricEdge[];
}

/** A deliberately small, receipt-derived projection suitable for Cortex. */
export interface HermesExecutionFoldbackCortexProjection {
  schema: 'thoughtseed.cortex.terminal-receipt.v1';
  receiptId: string;
  receiptDigest: string;
  workObjectId: string;
  taskId: string;
  executionId: string;
  outcome: 'executed' | 'failed';
  terminalProofDigest: string;
  recordedAt: string;
  r2Key: string;
}

/** A bounded memory record with the complete, exact WorkObject lineage. */
export interface HermesExecutionFoldbackAgentMemoryProjection {
  schema: 'thoughtseed.agent-memory.terminal-receipt.v1';
  receiptId: string;
  receiptDigest: string;
  workObject: {
    id: string;
    kind: 'sapling' | 'branch' | 'program';
  };
  lineage: {
    nodeId: string;
    taskId: string;
    graphVersion: number;
    pinnedLoadoutId: string;
    executionId: string;
  };
  outcome: 'executed' | 'failed';
  terminalProofDigest: string;
  recordedAt: string;
  r2Key: string;
}

/**
 * A proposal has no Goal Graph write capability. The authoritative graph must
 * independently accept a later approval before it can create operational work.
 */
export interface HermesExecutionFoldbackNextIntentProposal {
  schema: 'thoughtseed.next-intent-proposal.v1';
  proposalId: string;
  receiptId: string;
  workObjectId: string;
  taskId: string;
  terminalProofDigest: string;
  approvalRequired: true;
  goalGraphAuthority: false;
  status: 'proposal-only';
}

export interface HermesExecutionFoldbackStoreLike {
  record(receipt: HermesExecutionFoldbackReceipt): Promise<{ duplicate: boolean }>;
}

/**
 * Implemented by the trusted orchestration boundary using immutable admission
 * readback. Foldback never treats a caller-supplied activation envelope as
 * authority on shape or digest self-consistency alone.
 */
export interface HermesExecutionFoldbackActivationVerifier {
  readonly source: 'external-admission-readback';
  verifyActivationAuthority(
    activation: NonNullable<HermesExecutionFoldbackInput['activation']>,
  ): boolean | Promise<boolean>;
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

function exactOptionalFields(value: Record<string, unknown>, fields: readonly string[], optional: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const allowed = [...fields, ...optional].sort();
  if (actual.some((field) => !allowed.includes(field)) || fields.some((field) => !Object.hasOwn(value, field))) {
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
  exactOptionalFields(raw, ['schema', 'tenantId', 'graphVersion', 'goalGraph', 'execution'], ['activation'], 'foldback input');
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
  let activation: HermesExecutionFoldbackInput['activation'];
  if (raw.activation !== undefined) {
    if (!isRecord(raw.activation)) throw new HermesExecutionFoldbackValidationError('activation must be an object');
    exactFields(raw.activation, [
      'activationId', 'activationDigest', 'mappingReceiptId', 'mappingReceiptDigest', 'issued', 'staleFence', 'workObjectId', 'taskId', 'pinnedLoadoutId', 'fencingToken',
    ], 'activation');
    if (raw.activation.issued !== true) {
      throw new HermesExecutionFoldbackValidationError('activation is not issued');
    }
    if (raw.activation.staleFence !== false) {
      throw new HermesExecutionFoldbackValidationError('activation fence is stale');
    }
    activation = {
      activationId: safeText(raw.activation.activationId, 'activation.activationId'),
      activationDigest: digest(raw.activation.activationDigest, 'activation.activationDigest'),
      mappingReceiptId: safeText(raw.activation.mappingReceiptId, 'activation.mappingReceiptId'),
      mappingReceiptDigest: digest(raw.activation.mappingReceiptDigest, 'activation.mappingReceiptDigest'),
      issued: true,
      staleFence: false,
      workObjectId: safeText(raw.activation.workObjectId, 'activation.workObjectId'),
      taskId: safeText(raw.activation.taskId, 'activation.taskId'),
      pinnedLoadoutId: safeText(raw.activation.pinnedLoadoutId, 'activation.pinnedLoadoutId'),
      fencingToken: safeText(raw.activation.fencingToken, 'activation.fencingToken'),
    };
    if (
      activation.workObjectId !== workObjectId
      || activation.taskId !== taskId
      || activation.pinnedLoadoutId !== pinnedLoadoutId
      || activation.fencingToken !== raw.execution.fencingToken
    ) {
      throw new HermesExecutionFoldbackValidationError('activation does not bind the terminal execution');
    }
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
    ...(activation ? { activation } : {}),
  };
}

function artifactPrefix(receipt: HermesExecutionFoldbackReceipt): string {
  return `portfolio/thoughtseed/workobjects/${receipt.goalGraph.workObjectId}/foldback`;
}

/**
 * Read only immutable receipt fields here. This intentionally has no access to
 * an inbound prompt, response, provider payload, credentials, or caller data.
 */
export function deriveHermesExecutionFoldbackCortexProjection(
  receipt: HermesExecutionFoldbackReceipt,
): HermesExecutionFoldbackCortexProjection {
  return {
    schema: 'thoughtseed.cortex.terminal-receipt.v1',
    receiptId: receipt.receiptId,
    receiptDigest: receipt.contentDigest,
    workObjectId: receipt.goalGraph.workObjectId,
    taskId: receipt.goalGraph.taskId,
    executionId: receipt.execution.executionId,
    outcome: receipt.execution.status,
    terminalProofDigest: receipt.execution.terminalProofDigest,
    recordedAt: receipt.execution.recordedAt,
    r2Key: `${artifactPrefix(receipt)}/cortex/${receipt.execution.executionId}.json`,
  };
}

export function deriveHermesExecutionFoldbackAgentMemoryProjection(
  receipt: HermesExecutionFoldbackReceipt,
): HermesExecutionFoldbackAgentMemoryProjection {
  return {
    schema: 'thoughtseed.agent-memory.terminal-receipt.v1',
    receiptId: receipt.receiptId,
    receiptDigest: receipt.contentDigest,
    workObject: {
      id: receipt.goalGraph.workObjectId,
      kind: receipt.goalGraph.workObjectKind,
    },
    lineage: {
      nodeId: receipt.goalGraph.nodeId,
      taskId: receipt.goalGraph.taskId,
      graphVersion: receipt.graphVersion,
      pinnedLoadoutId: receipt.goalGraph.pinnedLoadoutId,
      executionId: receipt.execution.executionId,
    },
    outcome: receipt.execution.status,
    terminalProofDigest: receipt.execution.terminalProofDigest,
    recordedAt: receipt.execution.recordedAt,
    r2Key: `${artifactPrefix(receipt)}/agent-memory/${receipt.execution.executionId}.json`,
  };
}

export function deriveHermesExecutionFoldbackNextIntentProposal(
  receipt: HermesExecutionFoldbackReceipt,
): HermesExecutionFoldbackNextIntentProposal {
  return {
    schema: 'thoughtseed.next-intent-proposal.v1',
    proposalId: `nip_${receipt.receiptId.slice(4)}`,
    receiptId: receipt.receiptId,
    workObjectId: receipt.goalGraph.workObjectId,
    taskId: receipt.goalGraph.taskId,
    terminalProofDigest: receipt.execution.terminalProofDigest,
    approvalRequired: true,
    goalGraphAuthority: false,
    status: 'proposal-only',
  };
}

export async function adaptHermesExecutionFoldback(
  raw: unknown,
  activationVerifier?: HermesExecutionFoldbackActivationVerifier,
): Promise<HermesExecutionFoldbackProjection> {
  const input = validateInput(raw);
  if (input.activation) {
    if (!activationVerifier || activationVerifier.source !== 'external-admission-readback') {
      throw new HermesExecutionFoldbackValidationError('activation requires an external admission readback verifier');
    }
    if (!await activationVerifier.verifyActivationAuthority(input.activation)) {
      throw new HermesExecutionFoldbackValidationError('activation lacks external admission readback proof');
    }
  }
  const contentDigestHex = await sha256(canonicalHermesFoldbackJson(input));
  const receiptId = `hfb_${contentDigestHex.slice(0, 24)}`;
  const receipt: HermesExecutionFoldbackReceipt = {
    ...input,
    receiptId,
    contentDigest: `sha256:${contentDigestHex}`,
    r2Key: `portfolio/thoughtseed/workobjects/${input.goalGraph.workObjectId}/foldback/${input.execution.executionId}.json`,
    status: 'prepared',
  };
  const admitted = input.activation !== undefined;
  const cortex = admitted ? deriveHermesExecutionFoldbackCortexProjection(receipt) : undefined;
  const agentMemory = admitted ? deriveHermesExecutionFoldbackAgentMemoryProjection(receipt) : undefined;
  const nextIntent = admitted ? deriveHermesExecutionFoldbackNextIntentProposal(receipt) : undefined;
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
    ...(cortex ? { cortex } : {}),
    ...(agentMemory ? { agentMemory } : {}),
    ...(nextIntent ? { nextIntent } : {}),
    node,
    edges: [
      { kind: 'proves', fromId: receiptId, toId: input.goalGraph.taskId },
      ...(nextIntent ? [{ kind: 'informs-next-intent' as const, fromId: receiptId, toId: input.goalGraph.workObjectId }] : []),
    ],
  };
}

export async function validateHermesExecutionFoldbackReceipt(
  raw: unknown,
  activationVerifier?: HermesExecutionFoldbackActivationVerifier,
): Promise<HermesExecutionFoldbackReceipt> {
  if (!isRecord(raw)) throw new HermesExecutionFoldbackValidationError('foldback receipt must be an object');
  exactOptionalFields(raw, [
    'schema', 'tenantId', 'graphVersion', 'goalGraph', 'execution', 'receiptId', 'contentDigest', 'r2Key', 'status',
  ], ['activation'], 'foldback receipt');
  const {
    receiptId: _receiptId,
    contentDigest: _contentDigest,
    r2Key: _r2Key,
    status: _status,
    ...input
  } = raw;
  const expected = (await adaptHermesExecutionFoldback(input, activationVerifier)).receipt;
  if (canonicalHermesFoldbackJson(raw) !== canonicalHermesFoldbackJson(expected)) {
    throw new HermesExecutionFoldbackValidationError('foldback receipt derivation is invalid');
  }
  return expected;
}

export function createHermesExecutionFoldbackStore(
  bucket: R2BucketLike,
  activationVerifier?: HermesExecutionFoldbackActivationVerifier,
): HermesExecutionFoldbackStoreLike {
  if (!bucket.put) throw new HermesExecutionFoldbackStorageError('foldback R2 binding is not writable');
  return {
    async record(receipt) {
      const validated = await validateHermesExecutionFoldbackReceipt(receipt, activationVerifier);
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

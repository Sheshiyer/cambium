/** Provider-neutral projection of a terminal receipt read through Hermes admission.
 * The composition owner supplies the trusted reader created with its external
 * admission verifier. This adapter has no raw-receipt, activation, or write input.
 */
import { createHash } from 'node:crypto';
import {
  canonicalHermesFoldbackJson,
  deriveHermesExecutionFoldbackCortexProjection,
  type HermesExecutionFoldbackReaderLike,
  type HermesExecutionFoldbackReadBinding,
} from '../../workers/quests/src/hermes-execution-foldback.ts';
import { copyScope, isCortexTextScope, type CortexTextScope, type CortexTextCitation } from './cortex-text.ts';

export interface FoldbackTextRequest {
  r2Key: string;
  binding: HermesExecutionFoldbackReadBinding;
  scope: CortexTextScope;
}

export interface FoldbackTextNote {
  schema: 'cortex.terminal-text.v1';
  noteId: string;
  scope: Readonly<CortexTextScope>;
  authorityTier: 'projection';
  effectsAuthorized: false;
  semanticAcceptance: false;
  text: string;
  citations: CortexTextCitation[];
  observedAt: string;
  evidence: {
    kind: 'admitted-foldback';
    receiptId: string;
    receiptDigest: string;
    terminalProofDigest: string;
    taskId: string;
    executionId: string;
    outcome: 'executed' | 'failed';
    r2Key: string;
  };
}

export type FoldbackTextResult =
  | { status: 'available'; note: FoldbackTextNote }
  | { status: 'held' | 'unavailable'; reason: 'invalid-scope' | 'scope-mismatch' | 'missing-evidence' | 'lineage-mismatch' | 'read-failed' };

const ID = /^[A-Za-z0-9][A-Za-z0-9._:@-]{0,159}$/;
const WORK = /^(sapling|branch|program):[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const RECEIPT = /^hfb_[a-f0-9]{24}$/;

/** Read one exact immutable receipt. No discovery, write, acceptance or ingestion. */
export async function readFoldbackText(
  reader: HermesExecutionFoldbackReaderLike,
  request: FoldbackTextRequest,
): Promise<FoldbackTextResult> {
  const supplied = request?.scope;
  if (!isCortexTextScope(supplied) || supplied.sourcePlane !== 'execution-learning'
    || !ID.test(supplied.tenantId) || !WORK.test(supplied.projectId)
    || (supplied.memberId !== undefined && !ID.test(supplied.memberId))) {
    return { status: 'held', reason: 'invalid-scope' };
  }
  const scope = copyScope(supplied);
  const binding = request?.binding && { ...request.binding, goalGraph: { ...request.binding.goalGraph } };
  if (!binding || binding.tenantId !== scope.tenantId || binding.goalGraph?.workObjectId !== scope.projectId) {
    return { status: 'held', reason: 'scope-mismatch' };
  }
  const prefix = `portfolio/thoughtseed/workobjects/${scope.projectId}/foldback/`;
  const r2Key = request.r2Key;
  if (typeof r2Key !== 'string' || !r2Key.startsWith(prefix)
    || !/^[A-Za-z0-9][A-Za-z0-9._:@-]{0,159}\.json$/.test(r2Key.slice(prefix.length))
    || r2Key.includes('..')) return { status: 'held', reason: 'lineage-mismatch' };
  let projection;
  try {
    projection = await reader.read(r2Key, binding);
  } catch {
    return { status: 'unavailable', reason: 'read-failed' };
  }
  if (!projection?.cortex || !projection.receipt?.activation) return { status: 'held', reason: 'missing-evidence' };
  try {
    const { receipt, cortex } = projection;
    const activation = receipt.activation;
    if (!activation) return { status: 'held', reason: 'missing-evidence' };
    const graph = receipt.goalGraph;
    const expected = binding.goalGraph;
    const execution = receipt.execution;
    if (receipt.tenantId !== scope.tenantId || receipt.graphVersion !== binding.graphVersion
      || receipt.r2Key !== r2Key || receipt.status !== 'prepared'
      || graph.workObjectId !== scope.projectId
      || (['nodeId', 'taskId', 'workObjectId', 'workObjectKind', 'pinnedLoadoutId'] as const)
        .some((key) => graph[key] !== expected[key])
      || (scope.audience === 'member' && scope.memberId !== execution.memberId)
      || !activation.issued || activation.staleFence
      || !RECEIPT.test(receipt.receiptId) || !DIGEST.test(receipt.contentDigest)
      || !DIGEST.test(execution.terminalProofDigest)
      || !ID.test(graph.taskId) || !ID.test(execution.executionId)
      || !['executed', 'failed'].includes(execution.status)
      || !Number.isFinite(Date.parse(execution.recordedAt))
      || canonicalHermesFoldbackJson(cortex) !== canonicalHermesFoldbackJson(deriveHermesExecutionFoldbackCortexProjection(receipt))) {
      return { status: 'held', reason: 'lineage-mismatch' };
    }
    const sha256 = createHash('sha256').update(canonicalHermesFoldbackJson(receipt)).digest('hex');
    return {
      status: 'available',
      note: {
        schema: 'cortex.terminal-text.v1',
        noteId: `hermes.${receipt.receiptId}`,
        scope: copyScope(scope),
        authorityTier: 'projection', effectsAuthorized: false, semanticAcceptance: false,
        text: `Hermes recorded a terminal ${execution.status} outcome for task ${graph.taskId} in ${graph.workObjectId}. `
          + `Execution ${execution.executionId} has admission-verified receipt ${receipt.receiptId}. `
          + 'This is bounded execution evidence; project ISA acceptance and further actions require their own authority.',
        citations: [{ uri: `receipt://hermes/${receipt.receiptId}`, sha256 }],
        observedAt: execution.recordedAt,
        evidence: {
          kind: 'admitted-foldback', receiptId: receipt.receiptId, receiptDigest: receipt.contentDigest,
          terminalProofDigest: execution.terminalProofDigest, taskId: graph.taskId,
          executionId: execution.executionId, outcome: execution.status, r2Key: receipt.r2Key,
        },
      },
    };
  } catch {
    return { status: 'held', reason: 'lineage-mismatch' };
  }
}

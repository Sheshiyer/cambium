// Server-owned terminal admission (wave0 Phase 1, T5/T6).
//
// The only authority is the current D1 Goal Graph, which changes solely through
// the Gate-approved sole graph writer. A node admits one native execution when
// its metadata carries an exact execution admission (six flat `executionAdmission*`
// scalar keys, see `executionAdmissionMetadata`) naming the member,
// directive and idempotency key, the authorized cluster, and the dispatch
// digest (the directive input digest). Nothing is read from the request: the
// outcome only selects which admission to look up, and every field it claims is
// compared against D1. Ambiguity, inactive/stopped nodes, rebinding, an
// unregistered loadout/cluster or any read failure yields no admission.
//
// The activation digest is an HMAC-SHA256 under a Worker secret
// (`WAVE0_ACTIVATION_KEY`), encoded as `sha256:<hex>` to fit the foldback
// schema, over the D1 admission AND the whole terminal execution tuple. Anyone
// who can write the vault R2 can neither compute one nor copy a genuine one
// onto a sibling receipt, so a planted receipt never reads as admitted. The verifier recomputes it from D1
// on every read, so an activation also expires as soon as the graph stops
// admitting exactly that task, loadout, cluster and dispatch.

import type { BridgeExecutionOutcomeInput } from './handler.ts';
import type { GoalGraphStoreLike } from './goal-graph-store.ts';
import type { GoalGraphHead, GoalGraphLoadoutAuthority, GoalGraphNode } from './goal-graph/types.ts';
import { GOAL_GRAPH_LOADOUT_AUTHORITY } from './goal-graph-loadout-registry.ts';
import { HERMES_EXECUTION_FOLDBACK_SCHEMA } from './hermes-execution-foldback.ts';
import type { HermesExecutionFoldbackActivationVerifier, HermesExecutionFoldbackInput } from './hermes-execution-foldback.ts';

export const EXECUTION_ADMISSION_SCHEMA = 'cambium.goal-graph.execution-admission.v1' as const;
const ACTIVATION_SCHEMA = 'cambium.goal-graph.execution-activation.v1';
const MAPPING_SCHEMA = 'cambium.goal-graph.execution-mapping.v1';
const MAPPING_PREFIX = 'gga:';
const SHA256_REF = /^sha256:[0-9a-f]{64}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,159}$/;
const WORK_ID = /^(sapling|branch|program):[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STOPPED: ReadonlySet<string> = new Set(['stopped', 'cancelled', 'canceled', 'expired']);
const TEXT = new TextEncoder();

export interface ExecutionAdmission {
  schema: typeof EXECUTION_ADMISSION_SCHEMA;
  memberId: string;
  directiveId: string;
  idempotencyKey: string;
  clusterId: string;
  dispatchDigest: string;
}

type Activation = NonNullable<HermesExecutionFoldbackInput['activation']>;
type Execution = HermesExecutionFoldbackInput['execution'];
type GoalGraphReader = Pick<GoalGraphStoreLike, 'readHead' | 'readNodes'>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (!isRecord(value)) return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
}

async function hmacOf(key: CryptoKey, value: unknown): Promise<string> {
  const bytes = await crypto.subtle.sign('HMAC', key, TEXT.encode(stable(value)) as unknown as BufferSource);
  return `sha256:${[...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

/** Imports the Worker secret; fewer than 32 bytes yields no key, which leaves admission unwired. */
export async function importActivationKey(secret: string | undefined): Promise<CryptoKey | null> {
  if (!secret || TEXT.encode(secret).length < 32) return null;
  return crypto.subtle.importKey('raw', TEXT.encode(secret) as unknown as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
}

async function digestOf(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', TEXT.encode(stable(value)) as unknown as BufferSource);
  return `sha256:${[...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The admission travels as six flat scalar metadata keys, because the Gate's
 * Telegram intake (the sole graph writer's only input) accepts scalar metadata
 * values only. Use `executionAdmissionMetadata` to produce them.
 */
const ADMISSION_KEYS = {
  schema: 'executionAdmissionSchema',
  memberId: 'executionAdmissionMemberId',
  directiveId: 'executionAdmissionDirectiveId',
  idempotencyKey: 'executionAdmissionIdempotencyKey',
  clusterId: 'executionAdmissionClusterId',
  dispatchDigest: 'executionAdmissionDispatchDigest',
} as const satisfies Record<keyof ExecutionAdmission, string>;

export function executionAdmissionMetadata(admission: ExecutionAdmission): Record<string, string> {
  return Object.fromEntries(Object.entries(ADMISSION_KEYS).map(([field, key]) => [key, admission[field as keyof ExecutionAdmission]]));
}

/** Exact parse of the D1 metadata keys; a partial, extra or malformed admission is no admission. */
export function parseExecutionAdmission(metadata: unknown): ExecutionAdmission | null {
  if (!isRecord(metadata)) return null;
  const known = new Set<string>(Object.values(ADMISSION_KEYS));
  if (Object.keys(metadata).some((key) => key.startsWith('executionAdmission') && !known.has(key))) return null;
  const raw = Object.fromEntries(Object.entries(ADMISSION_KEYS).map(([field, key]) => [field, metadata[key]]));
  if (raw.schema !== EXECUTION_ADMISSION_SCHEMA) return null;
  for (const field of ['memberId', 'directiveId', 'idempotencyKey', 'clusterId'] as const) {
    if (typeof raw[field] !== 'string' || !SAFE_ID.test(raw[field] as string)) return null;
  }
  if (typeof raw.dispatchDigest !== 'string' || !SHA256_REF.test(raw.dispatchDigest)) return null;
  return raw as unknown as ExecutionAdmission;
}

interface AdmittedNode {
  node: GoalGraphNode;
  admission: ExecutionAdmission;
  goalGraph: HermesExecutionFoldbackInput['goalGraph'];
}

function admittedNode(node: GoalGraphNode, head: GoalGraphHead, tenantId: string, loadouts: GoalGraphLoadoutAuthority): AdmittedNode | null {
  if (node.tenantId !== tenantId || node.status !== 'active' || node.graphVersion !== head.graphVersion) return null;
  if (typeof node.currentState === 'string' && STOPPED.has(node.currentState.toLowerCase())) return null;
  const admission = parseExecutionAdmission(node.metadata);
  if (!admission) return null;
  const workObjectId = node.workObjectId ?? null;
  const workObjectKind = node.workObjectKind ?? null;
  const pinnedLoadoutId = node.pinnedLoadoutId ?? null;
  if (!workObjectId || !workObjectKind || !pinnedLoadoutId) return null;
  const match = WORK_ID.exec(workObjectId);
  if (!match || match[1] !== workObjectKind) return null;
  const loadout = loadouts.resolve(pinnedLoadoutId);
  if (!loadout || !loadout.eligibleWorkObjectIds.includes(workObjectId) || !loadout.authorizedClusterIds.includes(admission.clusterId)) return null;
  const taskId = node.externalId ?? node.nodeId;
  return { node, admission, goalGraph: { nodeId: node.nodeId, taskId, workObjectId, workObjectKind, pinnedLoadoutId } };
}

async function activationFor(key: CryptoKey, tenantId: string, head: GoalGraphHead, admitted: AdmittedNode, execution: Execution): Promise<Activation> {
  const fencingToken = execution.fencingToken;
  const mappingReceiptDigest = await digestOf({
    schema: MAPPING_SCHEMA, tenantId, ...admitted.goalGraph, sourceDigest: admitted.node.sourceDigest, admission: admitted.admission,
  });
  const activationDigest = await hmacOf(key, {
    schema: ACTIVATION_SCHEMA, tenantId, graphVersion: head.graphVersion, graphDigest: head.graphDigest, mappingReceiptDigest, execution,
  });
  return {
    activationId: `gga_${activationDigest.slice('sha256:'.length, 'sha256:'.length + 24)}`,
    activationDigest,
    mappingReceiptId: `${MAPPING_PREFIX}${admitted.node.nodeId}`,
    mappingReceiptDigest,
    issued: true,
    staleFence: false,
    workObjectId: admitted.goalGraph.workObjectId,
    taskId: admitted.goalGraph.taskId,
    pinnedLoadoutId: admitted.goalGraph.pinnedLoadoutId,
    fencingToken,
  };
}

export interface GoalGraphTerminalAdmission {
  /** HandlerDeps.terminalFoldback.prepare: never populated from request fields. */
  prepare(outcome: BridgeExecutionOutcomeInput): Promise<HermesExecutionFoldbackInput | null>;
  activationVerifier: HermesExecutionFoldbackActivationVerifier;
}

export function createGoalGraphTerminalAdmission(deps: {
  tenantId: string;
  goalGraphStore: GoalGraphReader;
  activationKey: CryptoKey;
  loadouts?: GoalGraphLoadoutAuthority;
  /** Reuse one D1 read for the life of this object. Only for per-request instances. */
  cacheGraphReads?: boolean;
}): GoalGraphTerminalAdmission {
  const loadouts = deps.loadouts ?? GOAL_GRAPH_LOADOUT_AUTHORITY;
  let cached: Promise<{ head: GoalGraphHead; nodes: GoalGraphNode[] } | null> | undefined;
  function readGraph(): Promise<{ head: GoalGraphHead; nodes: GoalGraphNode[] } | null> {
    if (deps.cacheGraphReads && cached) return cached;
    const read = (async () => {
      const head = await deps.goalGraphStore.readHead(deps.tenantId);
      if (!head || head.tenantId !== deps.tenantId) return null;
      return { head, nodes: await deps.goalGraphStore.readNodes(deps.tenantId) };
    })();
    // A failed read is never cached, so a transient D1 error cannot pin a denial or a stale view.
    if (deps.cacheGraphReads) { cached = read; read.catch(() => { cached = undefined; }); }
    return read;
  }
  return {
    async prepare(outcome) {
      try {
        if (outcome.status !== 'executed' && outcome.status !== 'failed') return null;
        const graph = await readGraph();
        if (!graph) return null;
        const matches = graph.nodes
          .map((node) => admittedNode(node, graph.head, deps.tenantId, loadouts))
          .filter((entry): entry is AdmittedNode => entry !== null
            && entry.admission.memberId === outcome.memberId
            && entry.admission.directiveId === outcome.directiveId
            && entry.admission.idempotencyKey === outcome.idempotencyKey);
        // Exactly one admitted node, and it must name this exact dispatch.
        if (matches.length !== 1) return null;
        const [admitted] = matches;
        if (admitted.admission.dispatchDigest !== outcome.attestation.inputDigest) return null;
        const execution: Execution = {
            memberId: outcome.memberId,
            directiveId: outcome.directiveId,
            idempotencyKey: outcome.idempotencyKey,
            executionId: outcome.executionId,
            claimId: outcome.claimId,
            fencingToken: outcome.fencingToken,
            attempt: outcome.attempt,
            status: outcome.status,
            attestationId: outcome.attestation.id,
            inputDigest: outcome.attestation.inputDigest,
            terminalProofDigest: outcome.attestation.outputDigest ?? outcome.attestationDigest,
            recordedAt: outcome.attestation.finishedAt,
        };
        return {
          schema: HERMES_EXECUTION_FOLDBACK_SCHEMA,
          tenantId: deps.tenantId,
          graphVersion: graph.head.graphVersion,
          goalGraph: admitted.goalGraph,
          execution,
          activation: await activationFor(deps.activationKey, deps.tenantId, graph.head, admitted, execution),
        };
      } catch {
        return null;
      }
    },
    activationVerifier: {
      source: 'external-admission-readback',
      async verifyActivationAuthority(activation, execution) {
        try {
          // Without the execution there is nothing to bind the activation to.
          if (!execution || execution.fencingToken !== activation.fencingToken) return false;
          if (!activation.mappingReceiptId.startsWith(MAPPING_PREFIX)) return false;
          const nodeId = activation.mappingReceiptId.slice(MAPPING_PREFIX.length);
          const graph = await readGraph();
          if (!graph) return false;
          const node = graph.nodes.find((candidate) => candidate.nodeId === nodeId);
          const admitted = node ? admittedNode(node, graph.head, deps.tenantId, loadouts) : null;
          if (!admitted) return false;
          if (execution.memberId !== admitted.admission.memberId || execution.directiveId !== admitted.admission.directiveId
            || execution.idempotencyKey !== admitted.admission.idempotencyKey || execution.inputDigest !== admitted.admission.dispatchDigest) return false;
          const expected = await activationFor(deps.activationKey, deps.tenantId, graph.head, admitted, execution);
          return stable(expected) === stable(activation);
        } catch {
          return false;
        }
      },
    },
  };
}

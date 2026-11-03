/** Explicit founder-reviewed Work source. This establishes no execution admission. */
import { normalizeGoalGraphFields, type TelegramGoalGraphCompileContext, type TelegramGoalGraphRejected } from './goal-graph-intake.ts';
import { buildNode, sha256 } from './goal-graph/identity.ts';
import { compileGoalGraph, makeGoalGraphHead } from './goal-graph/compiler.ts';
import type { GoalGraphNode } from './goal-graph/types.ts';
import type { FabricNode } from './mission-fabric.ts';

export const OPERATIONAL_WORK_SCHEMA = 'cambium.founder.operational-work-intent.v1';
export const OPERATIONAL_WORK_NAMESPACE = 'founder-operational-work';
const rejected = (message: string): TelegramGoalGraphRejected => ({ accepted: false, rejected: true, status: 'rejected', code: 'malformed_input', errors: [message] });
const digest = /^[a-f0-9]{64}$/;

export function parseOperationalWorkBoundary(input: unknown, founderId: string) {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return rejected('intent object required');
    const raw = input as Record<string, unknown>;
    const keys = ['schema', 'version', 'tenantId', 'clientRequestId', 'expectedHeadDigest', 'goals'];
    if (Object.keys(raw).length !== keys.length || !keys.every(key => Object.hasOwn(raw, key))) return rejected('exact operational intent fields required');
    if (Buffer.byteLength(JSON.stringify(raw), 'utf8') > 16384) return rejected('intent exceeds byte limit');
    if (raw.schema !== OPERATIONAL_WORK_SCHEMA || raw.version !== 1 || raw.tenantId !== 'cambium') return rejected('schema, version or tenant mismatch');
    if (!/^access:[^\s\x00-\x1f]{1,249}$/.test(founderId)) return rejected('verified founder required');
    if (typeof raw.clientRequestId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(raw.clientRequestId)) return rejected('stable client request required');
    if (raw.expectedHeadDigest !== null && (typeof raw.expectedHeadDigest !== 'string' || !digest.test(raw.expectedHeadDigest))) return rejected('observed graph head required');
    if (!Array.isArray(raw.goals) || raw.goals.length !== 1) return rejected('one operational Work source required');
    const goal = normalizeGoalGraphFields(raw.goals[0], false);
    if (goal.namespace !== OPERATIONAL_WORK_NAMESPACE || goal.externalId !== 'cambium-work' || goal.workObjectId !== 'sapling:cambium' || goal.workObjectKind !== 'sapling') return rejected('exact Cambium operational identity required');
    if (goal.pinnedLoadoutId || Object.keys(goal.metadata).length || !goal.proofRequired || goal.scope !== 'meso' || goal.status === 'retired') return rejected('Work source requires proof and cannot grant execution authority');
    if (/(?:\/Users\/|\/Volumes\/|\/private\/|file:\/\/|CF_Authorization|Bearer\s)/i.test(JSON.stringify(goal))) return rejected('private material refused');
    const founderDigest = sha256(founderId);
    const value = { schema: OPERATIONAL_WORK_SCHEMA, version: 1, tenantId: 'cambium', expectedHeadDigest: raw.expectedHeadDigest as string | null,
      source: { kind: 'founder-operational-work', founderDigest, clientRequestId: raw.clientRequestId }, goals: [goal] };
    const contentDigest = `sha256:${sha256(value)}`;
    return { accepted: true as const, rejected: false as const, status: 'accepted' as const, value, canonical: JSON.stringify(value), contentDigest, sourceDigest: contentDigest,
      sourceRef: `founder-operational-work:cambium:${founderDigest}:${raw.clientRequestId}`,
      idempotencyKey: `founder-operational-work:v1:cambium:${founderDigest}:${raw.clientRequestId}` };
  } catch { return rejected('invalid operational Work intent'); }
}

export function parseOperationalWorkIntent(input: unknown, founderId: string, context: TelegramGoalGraphCompileContext) {
  const boundary = parseOperationalWorkBoundary(input, founderId);
  if (!boundary.accepted) return boundary;
  try {
    const current = context.currentNodes ?? [];
    const head = context.actualHead ?? null;
    if (head && makeGoalGraphHead('cambium', current, head.graphVersion, head.committedAt).graphDigest !== head.graphDigest) return rejected('graph read is inconsistent');
    const goal = boundary.value.goals[0];
    const roots = current.filter(node => node.parentNodeId === null);
    if ((current.length && (roots.length !== 1 || goal.parentNodeId !== roots[0].nodeId)) || (!current.length && goal.parentNodeId !== null)) return rejected('Work source must be attached to the exact tenant root');
    const { now: _helper, ...node } = buildNode({ ...goal, metadata: { operationalWorkSchema: OPERATIONAL_WORK_SCHEMA, workName: 'Cambium' },
      tenantId: 'cambium', workObjectId: 'sapling:cambium', workObjectKind: 'sapling', pinnedLoadoutId: null,
      sourceRef: boundary.sourceRef, sourceDigest: boundary.contentDigest, graphVersion: context.graphVersion ?? 1, now: context.now ?? '1970-01-01T00:00:00.000Z' });
    const prior = current.find(previous => previous.nodeId === node.nodeId);
    if (prior && !isOperationalWorkSource(prior)) return rejected('existing identity has different authority');
    const compile = compileGoalGraph({ tenantId: 'cambium', expectedHeadDigest: boundary.value.expectedHeadDigest, actualHead: head,
      currentNodes: current, proposedNodes: [...current.filter(previous => previous.nodeId !== node.nodeId), node], graphVersion: context.graphVersion ?? 1,
      sourceRef: boundary.sourceRef, sourceDigest: boundary.contentDigest, now: context.now, loadoutAuthority: context.loadoutAuthority });
    return { ...boundary, node, nodes: [node], compile };
  } catch { return rejected('operational Work compilation refused'); }
}

/** Called only on the coherent committed D1 graph, never catalog or intake drafts. */
export function isOperationalWorkSource(node: GoalGraphNode): boolean {
  return node.tenantId === 'cambium' && node.namespace === OPERATIONAL_WORK_NAMESPACE && node.externalId === 'cambium-work'
    && node.workObjectId === 'sapling:cambium' && node.workObjectKind === 'sapling' && !node.pinnedLoadoutId && node.proofRequired
    && node.metadata.operationalWorkSchema === OPERATIONAL_WORK_SCHEMA && node.metadata.workName === 'Cambium'
    && /^founder-operational-work:cambium:[a-f0-9]{64}:[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(node.sourceRef)
    && /^sha256:[a-f0-9]{64}$/.test(node.sourceDigest);
}

export function adaptOperationalWorkSources(nodes: readonly GoalGraphNode[]): FabricNode[] {
  const sources = nodes.filter(isOperationalWorkSource);
  if (sources.length !== 1) return []; // Ambiguity never chooses an authority.
  const node = sources[0];
  if (node.status === 'retired') return [];
  return [{ kind: 'work', value: { kind: 'sapling', workId: 'sapling:cambium', tenantId: 'cambium', name: 'Cambium',
    desiredState: node.desiredState, currentState: node.currentState, status: node.status, ownerId: node.owner,
    nextAction: node.nextAction, proofRequired: true, reviewAt: node.reviewAt, sourceRef: node.sourceRef, sourceDigest: node.sourceDigest,
    branchId: node.nodeId, branchKind: 'product', promotionState: 'supervised-branch', currentGate: 'founder-reviewed-work', organRoute: [] } }];
}

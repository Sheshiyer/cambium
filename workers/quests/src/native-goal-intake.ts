/** Founder-web bookkeeping proposals. No Telegram identity, loadout or execution grant. */
import { normalizeGoalGraphFields, type TelegramGoalGraphFields, type TelegramGoalGraphCompileContext, type TelegramGoalGraphRejected } from './goal-graph-intake.ts';
import { buildNode, sha256 } from './goal-graph/identity.ts';
import { compileGoalGraph } from './goal-graph/compiler.ts';
import { validateAuthoritativeInput } from './goal-graph/projection-contract.ts';

export const FOUNDER_BOOKKEEPING_SCHEMA = 'cambium.founder.goal-graph-intent.v1';
export const FOUNDER_BOOKKEEPING_MAX_BYTES = 65_536;
const WORK_OBJECTS = new Set(['sapling:lumen-bar', 'program:temperance-hermes']);
const KEYS = new Set(['schema', 'version', 'tenantId', 'clientRequestId', 'goals']);
const ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;

function rejected(message: string): TelegramGoalGraphRejected {
  return { accepted: false, rejected: true, status: 'rejected', code: 'malformed_input', errors: [message.slice(0, 240)] };
}

export function parseFounderBookkeepingBoundary(input: unknown, founderId: string) {
  try {
    const authority = validateAuthoritativeInput(input);
    if (!authority.accepted) return rejected('projections are not founder intents');
    if (!input || typeof input !== 'object' || Array.isArray(input)) return rejected('intent object required');
    if (Buffer.byteLength(JSON.stringify(input), 'utf8') > FOUNDER_BOOKKEEPING_MAX_BYTES) return rejected('intent exceeds byte limit');
    const raw = input as Record<string, unknown>;
    if (Object.keys(raw).some(key => !KEYS.has(key))) return rejected('unknown intake field');
    if (raw.schema !== FOUNDER_BOOKKEEPING_SCHEMA || raw.version !== 1 || raw.tenantId !== 'cambium') return rejected('schema, version or tenant mismatch');
    if (typeof founderId !== 'string' || !founderId.startsWith('access:') || founderId.length > 256) return rejected('verified founder required');
    if (typeof raw.clientRequestId !== 'string' || !ID.test(raw.clientRequestId)) return rejected('bounded clientRequestId required');
    if (!Array.isArray(raw.goals) || !raw.goals.length || raw.goals.length > 32) return rejected('one to 32 bookkeeping goals required');
    const goals = raw.goals.map(value => {
      const goal = normalizeGoalGraphFields(value, false);
      if (goal.namespace !== 'founder-bookkeeping' || !goal.externalId || !ID.test(goal.externalId)) throw new Error('stable bookkeeping namespace and externalId required');
      if (!goal.workObjectId || !WORK_OBJECTS.has(goal.workObjectId) || goal.workObjectKind !== goal.workObjectId.split(':')[0]) throw new Error('unsupported bookkeeping WorkObject');
      if (goal.pinnedLoadoutId || Object.keys(goal.metadata).some(key => /admission|execution|grant|lease|dispatch/i.test(key))) throw new Error('bookkeeping cannot grant execution authority');
      // Only compact publishable summaries/references enter this lane, never private host paths.
      if (/(?:\/Users\/|\/Volumes\/|\/private\/|file:\/\/|CF_Authorization|Bearer\s)/i.test(JSON.stringify(goal))) throw new Error('private path or credential material refused');
      return goal;
    });
    const identities = goals.map(goal => goal.externalId);
    if (new Set(identities).size !== identities.length) return rejected('duplicate bookkeeping identity');
    const founderDigest = sha256(founderId);
    const value = { schema: FOUNDER_BOOKKEEPING_SCHEMA, version: 1, tenantId: 'cambium',
      source: { kind: 'founder-web', founderDigest, clientRequestId: raw.clientRequestId }, goals };
    const contentDigest = `sha256:${sha256(value)}`;
    return { accepted: true as const, rejected: false as const, status: 'accepted' as const, value,
      canonical: JSON.stringify(value), contentDigest, sourceDigest: contentDigest,
      sourceRef: `founder-web:cambium:${founderDigest}:${raw.clientRequestId}`,
      idempotencyKey: `founder-web:goal-graph-intent:v1:cambium:${founderDigest}:${raw.clientRequestId}` };
  } catch (error) { return rejected(error instanceof Error ? error.message : 'malformed bookkeeping intent'); }
}

export function parseFounderBookkeepingIntent(input: unknown, founderId: string, context: TelegramGoalGraphCompileContext) {
  const boundary = parseFounderBookkeepingBoundary(input, founderId);
  if (!boundary.accepted) return boundary;
  try {
    const now = context.now ?? '1970-01-01T00:00:00.000Z';
    const nodes = boundary.value.goals.map((goal: TelegramGoalGraphFields) => {
      const { now: _helper, ...node } = buildNode({ ...goal, tenantId: boundary.value.tenantId,
        workObjectId: goal.workObjectId!, workObjectKind: goal.workObjectKind!, pinnedLoadoutId: null,
        sourceRef: boundary.sourceRef, sourceDigest: boundary.contentDigest, graphVersion: context.graphVersion ?? 1, now });
      return node;
    });
    const ids = new Set(nodes.map(node => node.nodeId));
    const current = context.currentNodes ?? [];
    // A bookkeeping update cannot take over an unrelated or admitted existing identity.
    for (const prior of current.filter(node => ids.has(node.nodeId))) {
      const next = nodes.find(node => node.nodeId === prior.nodeId)!;
      if (prior.pinnedLoadoutId || prior.workObjectId !== next.workObjectId) return rejected('existing identity has different authority');
      next.createdAt = prior.createdAt;
    }
    const compile = compileGoalGraph({ tenantId: boundary.value.tenantId,
      expectedHeadDigest: context.expectedHeadDigest ?? null, actualHead: context.actualHead ?? null,
      currentNodes: current, proposedNodes: [...current.filter(node => !ids.has(node.nodeId)), ...nodes],
      graphVersion: context.graphVersion ?? 1, sourceRef: boundary.sourceRef, sourceDigest: boundary.contentDigest,
      now, loadoutAuthority: context.loadoutAuthority });
    return { ...boundary, node: nodes[0], nodes, compile };
  } catch (error) { return rejected(error instanceof Error ? error.message : 'bookkeeping compile rejected'); }
}

import { compileGoalGraph } from './goal-graph/compiler.ts';
import { sha256 } from './goal-graph/identity.ts';
import type { FounderContext, FounderProposal } from './founder-decision.ts';
import type { FounderDecisionStore } from './goal-graph-store.ts';
import type { GoalGraphNode, GoalGraphLoadoutAuthority } from './goal-graph/types.ts';

export interface FounderRenewalInput {
  proposalId: string; version: number; changeDigest: string; nonce: string; expiresAt: string;
}
export function validFounderRenewalInput(value: unknown): value is FounderRenewalInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Object.keys(row).sort().join(',') === 'changeDigest,expiresAt,nonce,proposalId,version'
    && ['proposalId','changeDigest','nonce','expiresAt'].every(key => typeof row[key] === 'string' && !!row[key])
    && Number.isInteger(row.version) && Number(row.version) > 0;
}
function sameIntendedNode(a: GoalGraphNode, b: GoalGraphNode): boolean {
  const select = (node: GoalGraphNode) => {
    const { sourceRef, sourceDigest, graphVersion, createdAt, updatedAt, ...intended } = node;
    return intended;
  };
  return sha256(select(a)) === sha256(select(b));
}

/** Renewal writes only the existing pending-intake projection, never D1. */
export async function renewFounderProposal(deps: {
  context: FounderContext; input: FounderRenewalInput; proposal: FounderProposal;
  task: Record<string, unknown>; store: FounderDecisionStore; now(): string;
  loadoutAuthority?: GoalGraphLoadoutAuthority;
  persist(input: { tenantId: string; idempotencyKey: string; contentDigest: string; taskKey: string; task: Record<string, unknown> }): Promise<{ kind: string; task?: Record<string, unknown>; duplicate?: boolean }>;
}) {
  const { context, input, proposal: p, store } = deps;
  const refuse = (status: string) => ({ status, writerAuthority: false });
  if (p.id !== input.proposalId || p.version !== input.version || p.changeSet.changeDigest !== input.changeDigest
      || p.nonce !== input.nonce || p.expiresAt !== input.expiresAt) return refuse('changed');
  const existing = await store.readDecisionReceipt(p.tenantId, input.changeDigest, p.nonce);
  if (existing) return refuse('already_decided');
  if (!['pending','stale'].includes(String(deps.task.status))) return refuse('conflict');
  const head = await store.readHead(p.tenantId);
  const nodes = await store.readNodes(p.tenantId);
  const after = await store.readHead(p.tenantId);
  if ((head?.graphDigest ?? null) !== (after?.graphDigest ?? null) || (head?.graphVersion ?? 0) !== (after?.graphVersion ?? 0)) return refuse('unknown');
  if (nodes.some(node => node.tenantId !== p.tenantId) || new Set(nodes.map(node => node.nodeId)).size !== nodes.length
      || (head && [...head.nodeIds].sort().join('\n') !== nodes.map(node => node.nodeId).sort().join('\n'))) return refuse('unknown');
  const now = deps.now(), nowMs = Date.parse(now), expiryMs = Date.parse(p.expiresAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(expiryMs)) return refuse('unknown');
  if (expiryMs > nowMs && deps.task.status !== 'stale' && (head?.graphDigest ?? null) === p.changeSet.expectedHeadDigest) return refuse('not_renewable');

  const previous = deps.task.renewal as Record<string, unknown> | undefined;
  const ancestors = [...(Array.isArray(previous?.ancestors) ? previous.ancestors : []), input];
  if (ancestors.length > 16) return refuse('conflict');
  const lineage = { ancestors, proposalId: p.id, version: p.version, changeDigest: input.changeDigest, nonce: p.nonce,
    expiresAt: p.expiresAt, sourceRef: p.changeSet.sourceRef, sourceDigest: p.changeSet.sourceDigest,
    founderId: context.founderId, expectedHeadDigest: head?.graphDigest ?? null };
  const renewalId = sha256(lineage);
  const sourceRef = `founder-renewal:${renewalId}`;
  const nextVersion = (head?.graphVersion ?? 0) + 1;
  // Deterministic source and node bytes give concurrent retries the same digest,
  // task key and approval nonce even when their wall-clock samples differ.
  const rebase = (node: GoalGraphNode): GoalGraphNode => ({ ...node, graphVersion: nextVersion,
    sourceRef, sourceDigest: renewalId, updatedAt: head?.committedAt ?? node.updatedAt });
  const proposed = new Map(nodes.map(node => [node.nodeId, node]));
  let changes = 0;
  for (const node of p.changeSet.nodesToCreate) {
    const current = proposed.get(node.nodeId);
    if (current) { if (!sameIntendedNode(current, node)) return refuse('conflict'); }
    else { proposed.set(node.nodeId, rebase(node)); changes++; }
  }
  for (const update of p.changeSet.nodesToUpdate) {
    const current = proposed.get(update.nodeId);
    if (!current) return refuse('conflict');
    if (sameIntendedNode(current, update.after)) continue;
    if (!sameIntendedNode(current, update.before)) return refuse('conflict');
    proposed.set(update.nodeId, rebase(update.after)); changes++;
  }
  for (const node of p.changeSet.nodesToRemove) {
    const current = proposed.get(node.nodeId);
    if (!current) continue;
    if (!sameIntendedNode(current, node)) return refuse('conflict');
    proposed.delete(node.nodeId); changes++;
  }
  if (!changes) return refuse('already_applied');
  const compiled = compileGoalGraph({ tenantId: p.tenantId, expectedHeadDigest: head?.graphDigest ?? null,
    actualHead: head, currentNodes: nodes, proposedNodes: [...proposed.values()], graphVersion: nextVersion,
    sourceRef, sourceDigest: renewalId, now, loadoutAuthority: deps.loadoutAuthority });
  if (compiled.status !== 'compiled') return refuse('conflict');
  const changeSet = compiled.changeSet;
  const target = [...changeSet.nodesToCreate, ...changeSet.nodesToUpdate.map(update => update.after)]
    .find(node => node.nodeId === deps.task.nodeId);
  if (!target) return refuse('conflict');
  const task = {
    schema: 'cambium.goal-graph-intake-task.v1', tenantId: p.tenantId, status: 'pending',
    idempotencyKey: `founder-renewal:v1:${renewalId}`, contentDigest: renewalId,
    intentVersion: p.version + 1, sourceRef, sourceDigest: renewalId,
    changeDigest: changeSet.changeDigest, graphVersion: nextVersion,
    expectedHeadDigest: head?.graphDigest ?? null, expectedHeadVersion: head?.graphVersion ?? 0, fence: nextVersion,
    nodeId: target.nodeId, node: target, changeSet, receivedAt: now, updatedAt: now,
    approvalNonce: `founder-renewal:${p.tenantId}:${renewalId}`,
    approvalExpiresAt: new Date(nowMs + 15 * 60_000).toISOString(),
    renewal: { ...lineage, renewalId },
  };
  // A decision may win while the read-only rebase runs; never renew its expiry.
  if (await store.readDecisionReceipt(p.tenantId, input.changeDigest, p.nonce)) return refuse('already_decided');
  const saved = await deps.persist({ tenantId: p.tenantId, idempotencyKey: task.idempotencyKey,
    contentDigest: task.contentDigest, taskKey: `goal-graph-intake-task:${p.tenantId}:${changeSet.changeDigest}`, task });
  if (saved.kind !== 'ready' || !saved.task) return refuse('conflict');
  if (await store.readDecisionReceipt(p.tenantId, input.changeDigest, p.nonce)) return refuse('already_decided');
  const result = saved.task;
  if (result.idempotencyKey !== task.idempotencyKey || result.contentDigest !== renewalId
      || result.changeDigest !== changeSet.changeDigest || result.intentVersion !== task.intentVersion
      || result.expectedHeadDigest !== task.expectedHeadDigest || result.approvalNonce !== task.approvalNonce
      || sha256(result.renewal) !== sha256(task.renewal)) return refuse('conflict');
  return { status: saved.duplicate ? 'duplicate' : 'renewed', proposalId: `${p.tenantId}:${result.changeDigest}`,
    changeDigest: result.changeDigest, version: result.intentVersion, expiresAt: result.approvalExpiresAt, writerAuthority: false };
}

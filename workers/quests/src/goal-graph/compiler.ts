import { nodeContentDigest, validateNodeSet } from './identity.ts';
import type {
  GoalChangeSet, GoalGraphCompileInput, GoalGraphCompileResult, GoalGraphHead,
  GoalGraphInputNode, GoalGraphMigrationMapping, GoalGraphNode, GraphMigrationClass,
} from './types.ts';
import { sha256 } from './identity.ts';

function stableNode(node: GoalGraphNode): GoalGraphNode {
  return { ...node, metadata: { ...node.metadata } };
}

function normalizeNodes(input: readonly GoalGraphInputNode[], tenantId: string, now: string): GoalGraphNode[] {
  const nodes = input.map((node) => ({
    ...node,
    tenantId,
    nodeId: node.nodeId ?? `goal_${sha256({ tenantId, namespace: node.namespace, externalId: node.externalId, sourceRef: node.sourceRef, sourceDigest: node.sourceDigest })}`,
    createdAt: node.createdAt ?? now,
    updatedAt: node.updatedAt ?? now,
  } as GoalGraphNode)).map(stableNode);
  nodes.sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  return nodes;
}

function digestHead(tenantId: string, nodes: readonly GoalGraphNode[]): string {
  return sha256({ tenantId, nodes: [...nodes].sort((a, b) => a.nodeId.localeCompare(b.nodeId)).map((node) => ({ nodeId: node.nodeId, contentDigest: nodeContentDigest(node) })) });
}

function semanticEqual(a: GoalGraphNode, b: GoalGraphNode): boolean {
  return nodeContentDigest(a) === nodeContentDigest(b);
}

export function makeGoalGraphHead(tenantId: string, nodes: readonly GoalGraphNode[], graphVersion: number, now: string, sourceRef: string | null = null, sourceDigest: string | null = null): GoalGraphHead {
  const sorted = [...nodes].sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  return { tenantId, graphVersion, graphDigest: digestHead(tenantId, sorted), nodeIds: sorted.map((node) => node.nodeId), sourceRef, sourceDigest, committedAt: now };
}

export function compileGoalGraph(input: GoalGraphCompileInput): GoalGraphCompileResult {
  const actualDigest = input.actualHead?.graphDigest ?? null;
  if (actualDigest !== input.expectedHeadDigest) return { status: 'stale', expectedHeadDigest: input.expectedHeadDigest, actualHeadDigest: actualDigest };
  const now = input.now ?? '1970-01-01T00:00:00.000Z';
  const proposed = normalizeNodes(input.proposedNodes, input.tenantId, now);
  const validation = validateNodeSet(proposed);
  if (!validation.valid) throw new Error(validation.code);
  const current = [...input.currentNodes].sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  const currentById = new Map(current.map((node) => [node.nodeId, node]));
  const proposedById = new Map(proposed.map((node) => [node.nodeId, node]));
  const nodesToCreate = proposed.filter((node) => !currentById.has(node.nodeId));
  const nodesToRemove = current.filter((node) => !proposedById.has(node.nodeId));
  const nodesToUpdate = proposed.filter((node) => {
    const before = currentById.get(node.nodeId);
    return before && !semanticEqual(before, node);
  }).map((after) => ({ nodeId: after.nodeId, before: currentById.get(after.nodeId)!, after }));
  const orderedUpdates = nodesToUpdate.sort((a, b) => a.nodeId.localeCompare(b.nodeId));
  const changeDigest = sha256({ tenantId: input.tenantId, expectedHeadDigest: input.expectedHeadDigest, graphVersion: input.graphVersion, nodesToCreate, nodesToUpdate: orderedUpdates, nodesToRemove, sourceRef: input.sourceRef, sourceDigest: input.sourceDigest });
  const changeSet: GoalChangeSet = { tenantId: input.tenantId, expectedHeadDigest: input.expectedHeadDigest, graphVersion: input.graphVersion, nodesToCreate, nodesToUpdate: orderedUpdates, nodesToRemove, changeDigest, isNoop: nodesToCreate.length === 0 && orderedUpdates.length === 0 && nodesToRemove.length === 0, sourceRef: input.sourceRef, sourceDigest: input.sourceDigest };
  return { status: 'compiled', changeSet };
}

export function classifyMigration(fromNodeIds: readonly string[], toNodeIds: readonly string[]): GraphMigrationClass {
  if (fromNodeIds.length === 1 && toNodeIds.length === 1) return fromNodeIds[0] === toNodeIds[0] ? 'unchanged' : 'replaced';
  if (fromNodeIds.length === 1 && toNodeIds.length === 0) return 'retired';
  if (fromNodeIds.length === 1 && toNodeIds.length > 1) return 'split';
  if (fromNodeIds.length > 1 && toNodeIds.length === 1) return 'merged';
  return 'unmapped';
}

export function makeMigrationMapping(fromNodeIds: readonly string[], toNodeIds: readonly string[]): GoalGraphMigrationMapping {
  const classification = classifyMigration(fromNodeIds, toNodeIds);
  const proofDisposition = classification === 'unchanged' ? 'preserve' : classification === 'replaced' ? 'revalidate' : classification === 'retired' ? 'retire' : 'review_required';
  return { fromNodeIds: [...fromNodeIds], toNodeIds: [...toNodeIds], classification, proofDisposition, reviewRequired: classification === 'split' || classification === 'merged' || classification === 'unmapped' };
}

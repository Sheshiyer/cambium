import { createHash } from 'node:crypto';
import type { GoalGraphInputNode, GoalGraphNode } from './types.ts';

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}

export function sha256(value: unknown): string {
  return createHash('sha256').update(canonicalJson(value), 'utf8').digest('hex');
}

export interface StableIdentityInput {
  tenantId: string;
  namespace: string;
  externalId?: string | null;
  sourceRef: string;
  sourceDigest: string;
}

/** External IDs are preferred; provenance plus content digest is deterministic fallback identity. */
export function resolveNodeId(input: StableIdentityInput): string {
  const identity = input.externalId
    ? { tenantId: input.tenantId, namespace: input.namespace, externalId: input.externalId }
    : { tenantId: input.tenantId, namespace: input.namespace, sourceRef: input.sourceRef, sourceDigest: input.sourceDigest };
  return `goal_${sha256(identity)}`;
}

export function nodeContentDigest(node: GoalGraphNode | GoalGraphInputNode): string {
  const { nodeId: _nodeId, createdAt: _createdAt, updatedAt: _updatedAt, sourceDigest: _sourceDigest, ...content } = node;
  return sha256(content);
}

export type IdentityValidation = {
  valid: true;
} | { valid: false; code: 'identity_collision' | 'multiple_roots' | 'missing_parent' | 'cross_tenant_parent'; message: string };

/** Validate identity uniqueness and the singleton tenant-root invariant. */
export function validateNodeSet(nodes: readonly GoalGraphNode[]): IdentityValidation {
  const byId = new Map<string, GoalGraphNode>();
  const roots = new Map<string, string>();
  for (const node of nodes) {
    const existing = byId.get(node.nodeId);
    if (existing) {
      if (nodeContentDigest(existing) !== nodeContentDigest(node)) {
        return { valid: false, code: 'identity_collision', message: `node identity collision: ${node.nodeId}` };
      }
      continue;
    }
    byId.set(node.nodeId, node);
    if (node.parentNodeId === null) {
      const previous = roots.get(node.tenantId);
      if (previous) return { valid: false, code: 'multiple_roots', message: `tenant ${node.tenantId} has roots ${previous} and ${node.nodeId}` };
      roots.set(node.tenantId, node.nodeId);
    }
  }
  for (const node of byId.values()) {
    if (node.parentNodeId === null) continue;
    const parent = byId.get(node.parentNodeId);
    if (!parent) return { valid: false, code: 'missing_parent', message: `node ${node.nodeId} references missing parent ${node.parentNodeId}` };
    if (parent.tenantId !== node.tenantId) return { valid: false, code: 'cross_tenant_parent', message: `node ${node.nodeId} crosses tenant boundary` };
  }
  for (const tenantId of new Set([...byId.values()].map((node) => node.tenantId))) {
    if (!roots.has(tenantId)) return { valid: false, code: 'missing_parent', message: `tenant ${tenantId} has no singleton root` };
  }
  return { valid: true };
}

export interface BuildNodeInput extends Omit<GoalGraphInputNode, 'nodeId' | 'createdAt' | 'updatedAt'> {
  now?: string;
}

export function buildNode(input: BuildNodeInput): GoalGraphNode {
  const now = input.now ?? new Date().toISOString();
  const nodeId = resolveNodeId(input);
  return { ...input, nodeId, createdAt: now, updatedAt: now };
}

import { makeGoalGraphHead } from './goal-graph/compiler.ts';
import type { GoalGraphHead, GoalGraphNode } from './goal-graph/types.ts';
import type { GoalGraphStoreLike } from './goal-graph-store.ts';
import { PORTFOLIO_CATALOG } from './portfolio-catalog.ts';
import type { Principal } from './rbac.ts';

type WorkObjectKind = 'sapling' | 'branch' | 'program';

export interface PlexusWorkReferenceRequest {
  tenantId: string;
  workObjectId: string;
  workObjectKind: WorkObjectKind;
  nodeId: string;
  expectedGraphDigest: string;
  expectedGraphVersion: number;
}

/** Trusted server-resolved resource scope, never a client claim or Principal.allow. */
export interface PlexusWorkReferenceResourceGrant {
  schema: 'plexus.work-reference-resource-grant.v1';
  principalId: string;
  tenantId: string;
  workObjectIds: readonly string[];
  expiresAt: string;
}

export interface PlexusWorkReferenceInput {
  request: PlexusWorkReferenceRequest;
  principal: Principal;
  resourceGrant: PlexusWorkReferenceResourceGrant;
  store: Pick<GoalGraphStoreLike, 'readHead' | 'readNodes'> | null;
  /** Trusted clock dependency, not a request-supplied timestamp. */
  clock?: () => string;
}

export interface PlexusWorkReferenceReceipt {
  schema: 'plexus.work-reference.v1';
  status: 'graph-reference-verified';
  tenantId: string;
  workObjectId: string;
  workObjectKind: WorkObjectKind;
  nodeId: string;
  graphDigest: string;
  graphVersion: number;
  checkedAt: string;
}

type RejectionCode = 'invalid_request' | 'principal_denied' | 'resource_denied'
  | 'unknown_work_object' | 'store_unavailable' | 'graph_missing' | 'graph_invalid'
  | 'graph_changed' | 'stale_graph' | 'node_missing' | 'node_mismatch'
  | 'node_inactive' | 'clock_invalid';

export type PlexusWorkReferenceResult = PlexusWorkReferenceReceipt
  | { status: 'rejected'; code: RejectionCode };

const TENANT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/;
const WORK_OBJECT = /^(sapling|branch|program):[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOADOUT_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/;
const DIGEST = /^[0-9a-f]{64}$/; // makeGoalGraphHead uses bare hex, not catalog sha256:<hex>.
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object'
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const text = (value: unknown): value is string => typeof value === 'string';
const safeId = (value: unknown): value is string => text(value) && SAFE_ID.test(value);
const version = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const workId = (value: unknown): value is string => text(value) && value.length <= 256 && WORK_OBJECT.test(value);
const nullableText = (value: unknown): boolean => value === null || text(value);
const timestamp = (value: unknown): value is string => text(value) && ISO.test(value)
  && Number.isFinite(Date.parse(value))
  && new Date(value).toISOString().replace('.000Z', 'Z') === value.replace('.000Z', 'Z');
const reject = (code: RejectionCode): PlexusWorkReferenceResult => ({ status: 'rejected', code });

function jsonData(value: unknown, ancestors = new Set<unknown>()): boolean {
  if (value === null || text(value) || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if ((!Array.isArray(value) && !record(value)) || ancestors.has(value) || ancestors.size >= 64) return false;
  ancestors.add(value);
  const valid = Object.values(value).every((child) => jsonData(child, ancestors));
  ancestors.delete(value);
  return valid;
}

function validRequest(value: unknown): value is PlexusWorkReferenceRequest {
  return record(value) && text(value.tenantId) && value.tenantId.length <= 128
    && TENANT.test(value.tenantId) && workId(value.workObjectId)
    && WORK_OBJECT.exec(value.workObjectId)?.[1] === value.workObjectKind
    && safeId(value.nodeId) && text(value.expectedGraphDigest) && DIGEST.test(value.expectedGraphDigest)
    && version(value.expectedGraphVersion);
}

function authorized(principal: unknown, grant: unknown, request: PlexusWorkReferenceRequest, now: string): RejectionCode | null {
  if (!record(principal) || !safeId(principal.id) || principal.tenant !== request.tenantId
    || (principal.role !== 'founder' && principal.role !== 'team')
    || !safeId(principal.createdBy) || !Array.isArray(principal.allow) || !principal.allow.every(text)
    || (principal.expiresAt !== undefined && (!timestamp(principal.expiresAt) || Date.parse(principal.expiresAt) <= Date.parse(now)))) {
    return 'principal_denied';
  }
  if (!record(grant) || grant.schema !== 'plexus.work-reference-resource-grant.v1'
    || grant.principalId !== principal.id || grant.tenantId !== request.tenantId
    || !timestamp(grant.expiresAt) || Date.parse(grant.expiresAt) <= Date.parse(now)
    || !Array.isArray(grant.workObjectIds) || grant.workObjectIds.length === 0
    || !grant.workObjectIds.every(workId) || new Set(grant.workObjectIds).size !== grant.workObjectIds.length
    || !grant.workObjectIds.includes(request.workObjectId)) return 'resource_denied';
  return null;
}

function canonicalIdentity(request: PlexusWorkReferenceRequest): boolean {
  const matches = PORTFOLIO_CATALOG.records.filter((entry) => entry.workId === request.workObjectId
    && entry.canonicalId === request.workObjectId);
  if (matches.length !== 1) return false;
  const entry = matches[0];
  const kind = entry.kind === 'sapling' ? 'sapling' : entry.programKind === 'client' ? 'branch' : 'program';
  // Catalog identity is not a tenant grant, lifecycle decision or execution approval.
  return kind === request.workObjectKind;
}

function validHead(value: unknown, tenantId: string, now: string): value is GoalGraphHead {
  return record(value) && value.tenantId === tenantId && version(value.graphVersion)
    && text(value.graphDigest) && DIGEST.test(value.graphDigest)
    && Array.isArray(value.nodeIds) && value.nodeIds.length > 0 && value.nodeIds.every(safeId)
    && new Set(value.nodeIds).size === value.nodeIds.length
    && nullableText(value.sourceRef) && nullableText(value.sourceDigest)
    && timestamp(value.committedAt) && Date.parse(value.committedAt) <= Date.parse(now);
}

function validNodes(value: unknown, head: GoalGraphHead): value is GoalGraphNode[] {
  if (!Array.isArray(value) || value.length !== head.nodeIds.length) return false;
  const ids = new Set<string>();
  for (const node of value) {
    if (!record(node) || !safeId(node.nodeId) || ids.has(node.nodeId) || node.tenantId !== head.tenantId
      || !safeId(node.namespace) || !nullableText(node.externalId)
      || !(node.parentNodeId === null || safeId(node.parentNodeId))
      || !text(node.scope) || !['macro', 'meso', 'micro', 'proof'].includes(node.scope)
      || !text(node.status) || !['draft', 'active', 'blocked', 'paused', 'retired'].includes(node.status)
      || !text(node.desiredState) || !text(node.currentState) || !text(node.owner)
      || !nullableText(node.nextAction) || !nullableText(node.waitCondition)
      || typeof node.proofRequired !== 'boolean' || !(node.reviewAt === null || timestamp(node.reviewAt))
      || !text(node.sourceRef) || !text(node.sourceDigest) || !record(node.metadata) || !jsonData(node.metadata)
      || !version(node.graphVersion) || node.graphVersion > head.graphVersion
      || !timestamp(node.createdAt) || !timestamp(node.updatedAt)
      || Date.parse(node.createdAt) > Date.parse(node.updatedAt)
      || Date.parse(node.updatedAt) > Date.parse(head.committedAt)) return false;
    const id = node.workObjectId ?? null;
    const kind = node.workObjectKind ?? null;
    if ((id === null) !== (kind === null)
      || (id !== null && (!workId(id) || WORK_OBJECT.exec(id)?.[1] !== kind))
      || (node.pinnedLoadoutId != null && (!text(node.pinnedLoadoutId) || !LOADOUT_ID.test(node.pinnedLoadoutId) || id === null))) return false;
    ids.add(node.nodeId);
  }
  if (!head.nodeIds.every((id) => ids.has(id))) return false;
  const nodes = value as GoalGraphNode[];
  const parents = new Map(nodes.map((node) => [node.nodeId, node.parentNodeId]));
  if (nodes.filter((node) => node.parentNodeId === null).length !== 1) return false;
  const resolved = new Set<string>();
  for (const node of nodes) {
    const path = new Set<string>();
    let id: string | null = node.nodeId;
    while (id !== null && !resolved.has(id)) {
      if (!parents.has(id) || path.has(id)) return false;
      path.add(id);
      id = parents.get(id)!;
    }
    for (const item of path) resolved.add(item);
  }
  return true;
}

function sameHead(a: GoalGraphHead, b: GoalGraphHead): boolean {
  return a.tenantId === b.tenantId && a.graphDigest === b.graphDigest && a.graphVersion === b.graphVersion
    && a.committedAt === b.committedAt && a.sourceRef === b.sourceRef && a.sourceDigest === b.sourceDigest
    && a.nodeIds.length === b.nodeIds.length && a.nodeIds.every((id) => b.nodeIds.includes(id));
}

/** Read-only prerequisite: verifies a committed reference; never admits or executes work. */
export async function resolvePlexusWorkReference(input: PlexusWorkReferenceInput): Promise<PlexusWorkReferenceResult> {
  let request: PlexusWorkReferenceRequest;
  let principal: Principal;
  let resourceGrant: PlexusWorkReferenceResourceGrant;
  try {
    ({ request, principal, resourceGrant } = structuredClone({
      request: input.request, principal: input.principal, resourceGrant: input.resourceGrant,
    }));
  } catch { return reject('invalid_request'); }
  if (!validRequest(request)) return reject('invalid_request');
  const clock = input.clock ?? (() => new Date().toISOString());
  let startedAt: string;
  try { startedAt = clock(); } catch { return reject('clock_invalid'); }
  if (!timestamp(startedAt)) return reject('clock_invalid');
  const denial = authorized(principal, resourceGrant, request, startedAt);
  if (denial) return reject(denial);
  if (!canonicalIdentity(request)) return reject('unknown_work_object');
  let before: GoalGraphHead | null;
  let after: GoalGraphHead | null;
  let nodes: GoalGraphNode[];
  try {
    const store = input.store;
    if (!store || typeof store.readHead !== 'function' || typeof store.readNodes !== 'function') {
      return reject('store_unavailable');
    }
    before = structuredClone(await store.readHead(request.tenantId));
    if (before === null) return reject('graph_missing');
    if (!validHead(before, request.tenantId, startedAt)) return reject('graph_invalid');
    if (before.graphDigest !== request.expectedGraphDigest || before.graphVersion !== request.expectedGraphVersion) {
      return reject('stale_graph');
    }
    nodes = structuredClone(await store.readNodes(request.tenantId));
    after = structuredClone(await store.readHead(request.tenantId));
  } catch { return reject('store_unavailable'); }
  let checkedAt: string;
  try { checkedAt = clock(); } catch { return reject('clock_invalid'); }
  if (!timestamp(checkedAt) || Date.parse(checkedAt) < Date.parse(startedAt)) return reject('clock_invalid');
  const finalDenial = authorized(principal, resourceGrant, request, checkedAt);
  if (finalDenial) return reject(finalDenial);
  if (!validHead(after, request.tenantId, checkedAt)) return reject('graph_invalid');
  if (!sameHead(before, after)) return reject('graph_changed');
  try {
    if (!validNodes(nodes, before)) return reject('graph_invalid');
    const computed = makeGoalGraphHead(request.tenantId, nodes, before.graphVersion, before.committedAt, before.sourceRef, before.sourceDigest);
    if (!sameHead(computed, before)) return reject('graph_invalid');
  } catch { return reject('graph_invalid'); }
  const node = nodes.find((entry) => entry.nodeId === request.nodeId);
  if (!node) return reject('node_missing');
  if (node.workObjectId !== request.workObjectId || node.workObjectKind !== request.workObjectKind) return reject('node_mismatch');
  if (node.status !== 'active') return reject('node_inactive');
  return {
    schema: 'plexus.work-reference.v1', status: 'graph-reference-verified',
    tenantId: request.tenantId, workObjectId: request.workObjectId, workObjectKind: request.workObjectKind,
    nodeId: node.nodeId, graphDigest: before.graphDigest, graphVersion: before.graphVersion, checkedAt,
  };
}

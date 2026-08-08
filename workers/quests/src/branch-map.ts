/**
 * Read-only branch map projection for the Goal Graph.
 *
 * A branch map is evidence about authoritative nodes. Campaign and wiki
 * overlays are deliberately separate from node status, so an editorial signal
 * can never promote, retire, pause, or block a Goal Graph node. The contract is
 * pure, deterministic, and does not know about D1, Workers, or providers.
 */

import { createHash } from 'node:crypto';
import type { GoalGraphNode, GoalNodeStatus } from './goal-graph/types.ts';

export const BRANCH_MAP_PROJECTION_SCHEMA = 'cambium.goal-graph-branch-map.v1' as const;
export const BRANCH_MAP_PROJECTION_VERSION = 1 as const;
export const BRANCH_MAP_PROJECTION_VERSION_LABEL = 'goal-graph-branch-map@1.0.0' as const;

export type BranchMapGapKind = 'unknown' | 'pending';
export type BranchMapCampaignOverlayStatus = 'observed-active' | 'observed-paused' | 'claimed-paused' | 'unknown' | 'pending' | 'blocked';
export type BranchMapWikiOverlayStatus = 'linked' | 'missing' | 'stale' | 'unknown' | 'pending' | 'blocked';
export type BranchMapOverlayStatus = BranchMapCampaignOverlayStatus | BranchMapWikiOverlayStatus;
export type BranchMapReceiptStatus = 'verified' | 'pending' | 'unknown' | 'blocked';

export interface BranchMapBranchInput {
  branchId: string;
  label: string;
  nodeIds: readonly string[];
}

export interface BranchMapReceipt {
  receiptId: string;
  tenantId: string;
  branchId: string;
  /** Organ/organ service that observed the transition. */
  organId: string;
  organName: string;
  /** Transition endpoints; a null source denotes a branch root observation. */
  fromNodeId: string | null;
  toNodeId: string;
  observedAt: string;
  evidenceRefs: readonly string[];
  sourceRef: string;
  sourceDigest: string;
  graphVersion: number;
  status: BranchMapReceiptStatus;
}

export interface BranchMapLineage {
  nodeId: string;
  tenantId: string;
  branchId: string;
  parentNodeId: string | null;
  rootNodeId: string;
  sourceRef: string;
  sourceDigest: string;
}

export interface BranchMapCampaignOverlay {
  overlayId: string;
  branchId: string;
  label: string;
  status: BranchMapCampaignOverlayStatus;
  sourceRef: string;
  observedAt: string | null;
  freshness: 'fresh' | 'stale' | 'unverified';
  receiptId?: string | null;
}

export interface BranchMapWikiOverlay {
  overlayId: string;
  branchId: string;
  label: string;
  status: BranchMapWikiOverlayStatus;
  sourceRef: string;
  observedAt: string | null;
  freshness: 'fresh' | 'stale' | 'unverified';
  receiptId?: string | null;
}

export interface BranchMapGap {
  gapId: string;
  kind: BranchMapGapKind;
  code:
    | 'missing_receipt'
    | 'pending_receipt'
    | 'invalid_receipt'
    | 'missing_lineage'
    | 'invalid_lineage'
    | 'unknown_node'
    | 'unknown_branch'
    | 'pending_overlay'
    | 'unknown_overlay';
  branchId: string | null;
  nodeId: string | null;
  detail: string;
}

export interface BranchMapNode {
  nodeId: string;
  tenantId: string;
  branchId: string;
  namespace: string;
  desiredState: string;
  currentState: string;
  authoritativeStatus: GoalNodeStatus;
  sourceRef: string;
  sourceDigest: string;
  graphVersion: number;
}

export interface BranchMapBranch {
  branchId: string;
  label: string;
  nodeIds: readonly string[];
  /** Aggregated only from authoritative node statuses. */
  authoritativeStatus: GoalNodeStatus | 'unknown';
  campaignOverlays: readonly BranchMapCampaignOverlay[];
  wikiOverlays: readonly BranchMapWikiOverlay[];
}

export interface BranchMapOverlaySet {
  campaigns: readonly BranchMapCampaignOverlay[];
  wiki: readonly BranchMapWikiOverlay[];
}

export interface BranchMapProjection {
  schema: typeof BRANCH_MAP_PROJECTION_SCHEMA;
  version: typeof BRANCH_MAP_PROJECTION_VERSION;
  versionLabel: typeof BRANCH_MAP_PROJECTION_VERSION_LABEL;
  tenantId: string;
  graphVersion: number;
  graphDigest: string;
  generatedAt: string;
  sourceRef: string;
  nodes: readonly BranchMapNode[];
  branches: readonly BranchMapBranch[];
  receipts: readonly BranchMapReceipt[];
  lineage: readonly BranchMapLineage[];
  overlays: BranchMapOverlaySet;
  gaps: readonly BranchMapGap[];
  projectionDigest: string;
}

export interface BranchMapProjectionInput {
  tenantId: string;
  graphVersion: number;
  graphDigest: string;
  generatedAt: string;
  sourceRef: string;
  nodes: readonly GoalGraphNode[];
  branches?: readonly BranchMapBranchInput[];
  receipts?: readonly BranchMapReceipt[];
  lineage?: readonly BranchMapLineage[];
  campaignOverlays?: readonly BranchMapCampaignOverlay[];
  wikiOverlays?: readonly BranchMapWikiOverlay[];
}

export interface BranchMapAccepted {
  accepted: true;
  status: 'accepted';
  projection: BranchMapProjection;
}

export interface BranchMapRejected {
  accepted: false;
  status: 'rejected';
  errors: readonly string[];
}

export type BranchMapProjectionResult = BranchMapAccepted | BranchMapRejected;

export interface BranchMapValidationResult<T> {
  valid: boolean;
  value?: T;
  errors: readonly string[];
}

const BRANCH_KEYS = new Set(['branchId', 'label', 'nodeIds']);
const NODE_KEYS = new Set([
  'nodeId', 'tenantId', 'namespace', 'externalId', 'parentNodeId', 'scope', 'desiredState',
  'workObjectId', 'workObjectKind', 'pinnedLoadoutId',
  'currentState', 'owner', 'nextAction', 'waitCondition', 'proofRequired', 'reviewAt',
  'status', 'sourceRef', 'sourceDigest', 'graphVersion', 'metadata', 'createdAt', 'updatedAt',
]);
const RECEIPT_KEYS = new Set(['receiptId', 'tenantId', 'branchId', 'organId', 'organName', 'fromNodeId', 'toNodeId', 'observedAt', 'evidenceRefs', 'sourceRef', 'sourceDigest', 'graphVersion', 'status', 'nodeId']);
const LINEAGE_KEYS = new Set(['nodeId', 'tenantId', 'branchId', 'parentNodeId', 'rootNodeId', 'sourceRef', 'sourceDigest']);
const OVERLAY_KEYS = new Set(['overlayId', 'branchId', 'label', 'status', 'sourceRef', 'observedAt', 'freshness', 'receiptId']);
const INPUT_KEYS = new Set(['tenantId', 'graphVersion', 'graphDigest', 'generatedAt', 'sourceRef', 'nodes', 'branches', 'receipts', 'lineage', 'campaignOverlays', 'wikiOverlays']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasOwn = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);

function stableJson(value: unknown, seen = new Set<object>()): string {
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('non-finite number is not serializable');
    if (value === undefined || typeof value === 'function' || typeof value === 'symbol' || typeof value === 'bigint') throw new Error('value is not serializable');
    return JSON.stringify(value);
  }
  if (seen.has(value)) throw new Error('cyclic value is not serializable');
  seen.add(value);
  const output = Array.isArray(value)
    ? `[${value.map((item) => stableJson(item, seen)).join(',')}]`
    : `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key], seen)}`).join(',')}}`;
  seen.delete(value);
  return output;
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function bounded(value: unknown, field: string): string {
  if (!nonEmpty(value)) throw new Error(`${field} must be a non-empty string`);
  const normalized = value.trim();
  if (Buffer.byteLength(normalized, 'utf8') > 512) throw new Error(`${field} exceeds 512 bytes`);
  return normalized;
}

function positiveInteger(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) throw new Error(`${field} must be a positive integer`);
  return value;
}

function exactKeys(value: Record<string, unknown>, allowed: Set<string>, path: string, errors: string[]): void {
  for (const key of Object.keys(value)) if (!allowed.has(key)) errors.push(`${path}.${key} is not allowed`);
}

function validStatus(value: unknown): value is GoalNodeStatus {
  return value === 'draft' || value === 'active' || value === 'blocked' || value === 'paused' || value === 'retired';
}

function validateReceipt(value: unknown, expectedTenantId?: string, expectedGraphVersion?: number): BranchMapValidationResult<BranchMapReceipt> {
  if (!isRecord(value)) return { valid: false, errors: ['receipt must be an object'] };
  const errors: string[] = [];
  exactKeys(value, RECEIPT_KEYS, 'receipt', errors);
  try {
    const receiptId = bounded(value.receiptId, 'receipt.receiptId');
    const tenantId = bounded(value.tenantId, 'receipt.tenantId');
    const branchId = bounded(value.branchId, 'receipt.branchId');
    const organId = bounded(value.organId, 'receipt.organId');
    const organName = bounded(value.organName, 'receipt.organName');
    const fromNodeId = value.fromNodeId === null ? null : bounded(value.fromNodeId, 'receipt.fromNodeId');
    const toNodeId = bounded(value.toNodeId ?? value.nodeId, 'receipt.toNodeId');
    if (value.nodeId !== undefined && value.nodeId !== toNodeId) errors.push('receipt.nodeId must match receipt.toNodeId');
    if (fromNodeId !== null && fromNodeId === toNodeId) errors.push('receipt transition cannot point to itself');
    const observedAt = bounded(value.observedAt, 'receipt.observedAt');
    if (Number.isNaN(Date.parse(observedAt))) errors.push('receipt.observedAt must be an ISO date');
    if (!Array.isArray(value.evidenceRefs) || value.evidenceRefs.length > 32 || value.evidenceRefs.some((ref) => !nonEmpty(ref))) {
      errors.push('receipt.evidenceRefs must contain at most 32 non-empty strings');
    }
    const evidenceRefs = Array.isArray(value.evidenceRefs)
      ? value.evidenceRefs.map((ref) => bounded(ref, 'receipt.evidenceRefs[]'))
      : [];
    const sourceRef = bounded(value.sourceRef, 'receipt.sourceRef');
    const sourceDigest = bounded(value.sourceDigest, 'receipt.sourceDigest');
    const graphVersion = positiveInteger(value.graphVersion, 'receipt.graphVersion');
    if (expectedTenantId !== undefined && tenantId !== expectedTenantId) errors.push('receipt tenant does not match projection tenant');
    if (expectedGraphVersion !== undefined && graphVersion !== expectedGraphVersion) errors.push('receipt graph version does not match projection graph version');
    if (value.status !== 'verified' && value.status !== 'pending' && value.status !== 'unknown' && value.status !== 'blocked') errors.push('receipt.status is invalid');
    if (errors.length) return { valid: false, errors };
    return { valid: true, value: { receiptId, tenantId, branchId, organId, organName, fromNodeId, toNodeId, observedAt, evidenceRefs, sourceRef, sourceDigest, graphVersion, status: value.status }, errors: [] };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'invalid receipt');
    return { valid: false, errors };
  }
}

function validateLineage(value: unknown, expectedTenantId?: string): BranchMapValidationResult<BranchMapLineage> {
  if (!isRecord(value)) return { valid: false, errors: ['lineage must be an object'] };
  const errors: string[] = [];
  exactKeys(value, LINEAGE_KEYS, 'lineage', errors);
  try {
    const nodeId = bounded(value.nodeId, 'lineage.nodeId');
    const tenantId = bounded(value.tenantId, 'lineage.tenantId');
    const branchId = bounded(value.branchId, 'lineage.branchId');
    const rootNodeId = bounded(value.rootNodeId, 'lineage.rootNodeId');
    const sourceRef = bounded(value.sourceRef, 'lineage.sourceRef');
    const sourceDigest = bounded(value.sourceDigest, 'lineage.sourceDigest');
    const parentNodeId = value.parentNodeId === null ? null : bounded(value.parentNodeId, 'lineage.parentNodeId');
    if (expectedTenantId !== undefined && tenantId !== expectedTenantId) errors.push('lineage tenant does not match projection tenant');
    if (errors.length) return { valid: false, errors };
    return { valid: true, value: { nodeId, tenantId, branchId, parentNodeId, rootNodeId, sourceRef, sourceDigest }, errors: [] };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'invalid lineage');
    return { valid: false, errors };
  }
}

function validateOverlay(value: unknown, path: string, type: 'campaign' | 'wiki'): BranchMapValidationResult<BranchMapCampaignOverlay | BranchMapWikiOverlay> {
  if (!isRecord(value)) return { valid: false, errors: [`${path} must be an object`] };
  const errors: string[] = [];
  exactKeys(value, OVERLAY_KEYS, path, errors);
  try {
    const overlayId = bounded(value.overlayId, `${path}.overlayId`);
    const branchId = bounded(value.branchId, `${path}.branchId`);
    const label = bounded(value.label, `${path}.label`);
    const campaignStatuses: readonly string[] = ['observed-active', 'observed-paused', 'claimed-paused', 'unknown', 'pending', 'blocked'];
    const wikiStatuses: readonly string[] = ['linked', 'missing', 'stale', 'unknown', 'pending', 'blocked'];
    const allowedStatuses = type === 'campaign' ? campaignStatuses : wikiStatuses;
    if (typeof value.status !== 'string' || !allowedStatuses.includes(value.status)) errors.push(`${path}.status is invalid`);
    const sourceRef = bounded(value.sourceRef, `${path}.sourceRef`);
    const observedAt = value.observedAt === undefined || value.observedAt === null ? null : bounded(value.observedAt, `${path}.observedAt`);
    if (observedAt !== null && Number.isNaN(Date.parse(observedAt))) errors.push(`${path}.observedAt must be an ISO date`);
    if (value.freshness !== 'fresh' && value.freshness !== 'stale' && value.freshness !== 'unverified') errors.push(`${path}.freshness is invalid`);
    const receiptId = value.receiptId === undefined || value.receiptId === null ? null : bounded(value.receiptId, `${path}.receiptId`);
    if (errors.length) return { valid: false, errors };
    return { valid: true, value: { overlayId, branchId, label, status: value.status, sourceRef, observedAt, freshness: value.freshness, receiptId } as BranchMapCampaignOverlay | BranchMapWikiOverlay, errors: [] };
  } catch (error) {
    errors.push(error instanceof Error ? error.message : `invalid ${path}`);
    return { valid: false, errors };
  }
}

export function validateBranchMapReceipt(value: unknown, expectedTenantId?: string, expectedGraphVersion?: number): BranchMapValidationResult<BranchMapReceipt> {
  return validateReceipt(value, expectedTenantId, expectedGraphVersion);
}

export function validateBranchMapLineage(value: unknown, expectedTenantId?: string): BranchMapValidationResult<BranchMapLineage> {
  return validateLineage(value, expectedTenantId);
}

function gap(kind: BranchMapGapKind, code: BranchMapGap['code'], branchId: string | null, nodeId: string | null, detail: string): BranchMapGap {
  const identity = stableJson({ kind, code, branchId, nodeId, detail });
  return { gapId: `gap_${sha256(identity).slice(0, 24)}`, kind, code, branchId, nodeId, detail };
}

function compare(a: string, b: string): number {
  return a.localeCompare(b);
}

function aggregateStatus(nodes: readonly BranchMapNode[]): GoalNodeStatus | 'unknown' {
  if (nodes.length === 0) return 'unknown';
  if (nodes.some((node) => node.authoritativeStatus === 'blocked')) return 'blocked';
  if (nodes.some((node) => node.authoritativeStatus === 'active')) return 'active';
  if (nodes.some((node) => node.authoritativeStatus === 'paused')) return 'paused';
  if (nodes.every((node) => node.authoritativeStatus === 'retired')) return 'retired';
  if (nodes.every((node) => node.authoritativeStatus === 'draft')) return 'draft';
  return 'unknown';
}

function projectionBody(projection: Omit<BranchMapProjection, 'projectionDigest'>): Omit<BranchMapProjection, 'projectionDigest'> {
  return projection;
}

export function canonicalizeBranchMapProjection(projection: BranchMapProjection): string {
  const { projectionDigest: _digest, ...body } = projection;
  return stableJson(projectionBody(body));
}

export function projectionDigest(projection: BranchMapProjection): string {
  return `sha256:${sha256(canonicalizeBranchMapProjection(projection))}`;
}

export function buildBranchMapProjection(input: unknown): BranchMapProjectionResult {
  try {
    if (!isRecord(input)) return { accepted: false, status: 'rejected', errors: ['branch map input must be an object'] };
    const inputErrors: string[] = [];
    exactKeys(input, INPUT_KEYS, 'input', inputErrors);
    const tenantId = bounded(input.tenantId, 'input.tenantId');
    const graphVersion = positiveInteger(input.graphVersion, 'input.graphVersion');
    const graphDigest = bounded(input.graphDigest, 'input.graphDigest');
    const generatedAt = bounded(input.generatedAt, 'input.generatedAt');
    if (Number.isNaN(Date.parse(generatedAt))) inputErrors.push('input.generatedAt must be an ISO date');
    const sourceRef = bounded(input.sourceRef, 'input.sourceRef');
    if (!Array.isArray(input.nodes)) inputErrors.push('input.nodes must be an array');
    if (inputErrors.length) return { accepted: false, status: 'rejected', errors: inputErrors };

    const sourceNodes = input.nodes as readonly unknown[];
    const nodeIds = new Set<string>();
    const nodeValues: BranchMapNode[] = [];
    const errors: string[] = [];
    for (const [index, raw] of sourceNodes.entries()) {
      if (!isRecord(raw)) { errors.push(`input.nodes[${index}] must be an object`); continue; }
      try {
        exactKeys(raw, NODE_KEYS, `input.nodes[${index}]`, errors);
        if (Object.keys(raw).some((key) => !NODE_KEYS.has(key))) continue;
        const nodeId = bounded(raw.nodeId, `input.nodes[${index}].nodeId`);
        const nodeTenantId = bounded(raw.tenantId, `input.nodes[${index}].tenantId`);
        const namespace = bounded(raw.namespace, `input.nodes[${index}].namespace`);
        const desiredState = bounded(raw.desiredState, `input.nodes[${index}].desiredState`);
        const currentState = bounded(raw.currentState, `input.nodes[${index}].currentState`);
        const sourceRef = bounded(raw.sourceRef, `input.nodes[${index}].sourceRef`);
        const sourceDigest = bounded(raw.sourceDigest, `input.nodes[${index}].sourceDigest`);
        const nodeGraphVersion = positiveInteger(raw.graphVersion, `input.nodes[${index}].graphVersion`);
        if (!validStatus(raw.status)) throw new Error(`input.nodes[${index}].status is invalid`);
        if (nodeTenantId !== tenantId) throw new Error(`input.nodes[${index}] crosses tenant boundary`);
        if (nodeGraphVersion !== graphVersion) throw new Error(`input.nodes[${index}] graph version mismatch`);
        if (nodeIds.has(nodeId)) throw new Error(`duplicate node id ${nodeId}`);
        nodeIds.add(nodeId);
        nodeValues.push({ nodeId, tenantId: nodeTenantId, branchId: namespace, namespace, desiredState, currentState, authoritativeStatus: raw.status, sourceRef, sourceDigest, graphVersion: nodeGraphVersion });
      } catch (error) {
        errors.push(error instanceof Error ? error.message : `input.nodes[${index}] is invalid`);
      }
    }
    if (errors.length) return { accepted: false, status: 'rejected', errors };
    nodeValues.sort((a, b) => compare(a.nodeId, b.nodeId));

    const branchesById = new Map<string, BranchMapBranchInput>();
    if (input.branches !== undefined) {
      if (!Array.isArray(input.branches)) return { accepted: false, status: 'rejected', errors: ['input.branches must be an array'] };
      for (const [index, raw] of input.branches.entries()) {
        if (!isRecord(raw)) { errors.push(`input.branches[${index}] must be an object`); continue; }
        const branchErrors: string[] = [];
        exactKeys(raw, BRANCH_KEYS, `input.branches[${index}]`, branchErrors);
        try {
          const branchId = bounded(raw.branchId, `input.branches[${index}].branchId`);
          const label = bounded(raw.label, `input.branches[${index}].label`);
          if (!Array.isArray(raw.nodeIds) || raw.nodeIds.some((id) => !nonEmpty(id))) throw new Error(`input.branches[${index}].nodeIds must contain strings`);
          const nodeIdsForBranch = [...new Set(raw.nodeIds.map((id) => bounded(id, `input.branches[${index}].nodeIds`)))].sort(compare);
          if (branchesById.has(branchId)) throw new Error(`duplicate branch id ${branchId}`);
          branchesById.set(branchId, { branchId, label, nodeIds: nodeIdsForBranch });
        } catch (error) {
          branchErrors.push(error instanceof Error ? error.message : `input.branches[${index}] is invalid`);
        }
        errors.push(...branchErrors);
      }
    }
    if (errors.length) return { accepted: false, status: 'rejected', errors };

    // With no explicit branch list, namespace is the stable branch identity.
    if (branchesById.size === 0) {
      const byNamespace = new Map<string, string[]>();
      for (const node of nodeValues) byNamespace.set(node.namespace, [...(byNamespace.get(node.namespace) ?? []), node.nodeId]);
      for (const [branchId, ids] of byNamespace.entries()) branchesById.set(branchId, { branchId, label: branchId, nodeIds: ids.sort(compare) });
    }
    const branchForNode = new Map<string, string>();
    const gaps: BranchMapGap[] = [];
    for (const [branchId, branch] of branchesById.entries()) {
      for (const nodeId of branch.nodeIds) {
        if (!nodeIds.has(nodeId)) gaps.push(gap('unknown', 'unknown_node', branchId, nodeId, `branch references unknown node ${nodeId}`));
        else if (branchForNode.has(nodeId)) gaps.push(gap('unknown', 'unknown_branch', branchId, nodeId, `node ${nodeId} is assigned to multiple branches`));
        else branchForNode.set(nodeId, branchId);
      }
    }
    for (const node of nodeValues) if (!branchForNode.has(node.nodeId)) {
      branchForNode.set(node.nodeId, node.namespace);
      if (!branchesById.has(node.namespace)) branchesById.set(node.namespace, { branchId: node.namespace, label: node.namespace, nodeIds: [node.nodeId] });
      else gaps.push(gap('unknown', 'unknown_branch', node.namespace, node.nodeId, `node ${node.nodeId} is absent from its branch assignment`));
    }
    const mappedNodes = nodeValues.map((node) => ({ ...node, branchId: branchForNode.get(node.nodeId)! }));

    const receipts: BranchMapReceipt[] = [];
    const receiptByNode = new Map<string, BranchMapReceipt>();
    const receiptIds = new Set<string>();
    const transitionKeys = new Set<string>();
    const transitionNext = new Map<string, string>();
    if (input.receipts !== undefined) {
      if (!Array.isArray(input.receipts)) return { accepted: false, status: 'rejected', errors: ['input.receipts must be an array'] };
      for (const raw of input.receipts) {
        const result = validateReceipt(raw, tenantId, graphVersion);
        if (!result.valid || !result.value) {
          gaps.push(gap('unknown', 'invalid_receipt', null, null, result.errors.join('; ')));
          continue;
        }
        const receipt = result.value;
        if (!nodeIds.has(receipt.toNodeId)) {
          gaps.push(gap('unknown', 'unknown_node', null, receipt.toNodeId, `receipt ${receipt.receiptId} references unknown destination node`));
          continue;
        }
        if (receipt.fromNodeId !== null && !nodeIds.has(receipt.fromNodeId)) {
          gaps.push(gap('unknown', 'unknown_node', null, receipt.toNodeId, `receipt ${receipt.receiptId} references unknown source node ${receipt.fromNodeId}`));
          continue;
        }
        const receiptNode = mappedNodes.find((candidate) => candidate.nodeId === receipt.toNodeId)!;
        if (receiptNode.branchId !== receipt.branchId) {
          gaps.push(gap('unknown', 'invalid_receipt', receiptNode.branchId, receipt.toNodeId, `receipt ${receipt.receiptId} branch does not match destination node`));
          continue;
        }
        const receiptParent = receipt.fromNodeId === null ? null : mappedNodes.find((candidate) => candidate.nodeId === receipt.fromNodeId);
        if (receiptParent && receiptParent.branchId !== receiptNode.branchId) {
          gaps.push(gap('unknown', 'invalid_receipt', receiptNode.branchId, receipt.toNodeId, `receipt ${receipt.receiptId} crosses branch boundary`));
          continue;
        }
        if (receiptNode.sourceRef !== receipt.sourceRef || receiptNode.sourceDigest !== receipt.sourceDigest) {
          gaps.push(gap('unknown', 'invalid_receipt', receiptNode.branchId, receipt.toNodeId, `receipt ${receipt.receiptId} provenance does not match node`));
          continue;
        }
        const transitionKey = `${receipt.fromNodeId ?? 'ROOT'}>${receipt.toNodeId}:${receipt.organId}`;
        if (transitionKeys.has(transitionKey)) {
          gaps.push(gap('unknown', 'invalid_receipt', receiptNode.branchId, receipt.toNodeId, `duplicate transition ${transitionKey}`));
          continue;
        }
        if (receiptIds.has(receipt.receiptId)) {
          gaps.push(gap('unknown', 'invalid_receipt', receiptNode.branchId, receipt.toNodeId, `duplicate receipt ${receipt.receiptId}`));
          continue;
        }
        if (receiptByNode.has(receipt.toNodeId)) {
          gaps.push(gap('unknown', 'invalid_receipt', receiptNode.branchId, receipt.toNodeId, `multiple receipts for node ${receipt.toNodeId}`));
          continue;
        }
        transitionKeys.add(transitionKey);
        if (receipt.fromNodeId !== null) transitionNext.set(receipt.fromNodeId, receipt.toNodeId);
        receiptIds.add(receipt.receiptId);
        receiptByNode.set(receipt.toNodeId, receipt);
        receipts.push(receipt);
        if (receipt.status === 'pending') gaps.push(gap('pending', 'pending_receipt', branchForNode.get(receipt.toNodeId) ?? null, receipt.toNodeId, `receipt ${receipt.receiptId} is pending`));
        if (receipt.status === 'unknown' || receipt.status === 'blocked') gaps.push(gap('unknown', 'invalid_receipt', branchForNode.get(receipt.toNodeId) ?? null, receipt.toNodeId, `receipt ${receipt.receiptId} is ${receipt.status}`));
      }
    }
    // A cycle in observed transitions is an unknown traversal, never a status
    // update. It remains visible as a bounded gap for operator reconciliation.
    for (const start of transitionNext.keys()) {
      const seen = new Set<string>();
      let cursor: string | undefined = start;
      while (cursor !== undefined) {
        if (seen.has(cursor)) {
          const cycleNode = mappedNodes.find((node) => node.nodeId === cursor);
          gaps.push(gap('unknown', 'invalid_receipt', cycleNode?.branchId ?? null, cursor, `receipt transition cycle detected at ${cursor}`));
          break;
        }
        seen.add(cursor);
        cursor = transitionNext.get(cursor);
      }
    }
    // The packet establishes an expected per-node receipt. Missing evidence is
    // pending work, not a silent omission.
    for (const node of mappedNodes) if (!receiptByNode.has(node.nodeId)) gaps.push(gap('pending', 'missing_receipt', node.branchId, node.nodeId, `packet-derived receipt for node ${node.nodeId} is pending`));
    receipts.sort((a, b) => compare(a.receiptId, b.receiptId));

    const lineageValues: BranchMapLineage[] = [];
    const lineageByNode = new Map<string, BranchMapLineage>();
    if (input.lineage !== undefined) {
      if (!Array.isArray(input.lineage)) return { accepted: false, status: 'rejected', errors: ['input.lineage must be an array'] };
      for (const raw of input.lineage) {
        const result = validateLineage(raw, tenantId);
        if (!result.valid || !result.value) { gaps.push(gap('unknown', 'invalid_lineage', null, null, result.errors.join('; '))); continue; }
        const lineage = result.value;
        const node = mappedNodes.find((candidate) => candidate.nodeId === lineage.nodeId);
        if (!node) { gaps.push(gap('unknown', 'unknown_node', lineage.branchId, lineage.nodeId, `lineage references unknown node ${lineage.nodeId}`)); continue; }
        if (node.branchId !== lineage.branchId || node.sourceRef !== lineage.sourceRef || node.sourceDigest !== lineage.sourceDigest) {
          gaps.push(gap('unknown', 'invalid_lineage', lineage.branchId, lineage.nodeId, `lineage provenance does not match node ${lineage.nodeId}`));
          continue;
        }
        if (lineage.parentNodeId !== null && !nodeIds.has(lineage.parentNodeId)) {
          gaps.push(gap('unknown', 'invalid_lineage', lineage.branchId, lineage.nodeId, `lineage parent ${lineage.parentNodeId} is unknown`));
          continue;
        }
        if (!nodeIds.has(lineage.rootNodeId)) {
          gaps.push(gap('unknown', 'invalid_lineage', lineage.branchId, lineage.nodeId, `lineage root ${lineage.rootNodeId} is unknown`));
          continue;
        }
        if (lineage.parentNodeId !== null) {
          const parent = mappedNodes.find((candidate) => candidate.nodeId === lineage.parentNodeId);
          if (!parent || parent.branchId !== lineage.branchId) {
            gaps.push(gap('unknown', 'invalid_lineage', lineage.branchId, lineage.nodeId, `lineage parent crosses branch boundary`));
            continue;
          }
        }
        if (lineageByNode.has(lineage.nodeId)) { gaps.push(gap('unknown', 'invalid_lineage', lineage.branchId, lineage.nodeId, `multiple lineage records for ${lineage.nodeId}`)); continue; }
        lineageByNode.set(lineage.nodeId, lineage);
        lineageValues.push(lineage);
      }
    }
    // A lineage cycle cannot be rendered as a rooted branch. Keep the records
    // read-only, but surface the ambiguity instead of inferring a root.
    for (const lineage of lineageValues) {
      const seen = new Set<string>();
      let cursor: string | null = lineage.nodeId;
      if (lineage.parentNodeId === null && lineage.rootNodeId !== lineage.nodeId) {
        gaps.push(gap('unknown', 'invalid_lineage', lineage.branchId, lineage.nodeId, `root lineage ${lineage.nodeId} points to ${lineage.rootNodeId}`));
      }
      while (cursor !== null) {
        if (seen.has(cursor)) {
          gaps.push(gap('unknown', 'invalid_lineage', lineage.branchId, lineage.nodeId, `lineage cycle detected at ${cursor}`));
          break;
        }
        seen.add(cursor);
        const current = lineageByNode.get(cursor);
        if (!current) {
          gaps.push(gap('unknown', 'invalid_lineage', lineage.branchId, lineage.nodeId, `lineage parent record for ${cursor} is missing`));
          break;
        }
        cursor = current.parentNodeId;
        if (cursor === null && seen.size > 0 && current.rootNodeId !== lineage.rootNodeId) {
          gaps.push(gap('unknown', 'invalid_lineage', lineage.branchId, lineage.nodeId, `lineage root ${lineage.rootNodeId} does not resolve to ${current.rootNodeId}`));
          break;
        }
      }
    }
    for (const node of mappedNodes) if (!lineageByNode.has(node.nodeId)) gaps.push(gap('unknown', 'missing_lineage', node.branchId, node.nodeId, `no lineage is bound to node ${node.nodeId}`));
    lineageValues.sort((a, b) => compare(a.nodeId, b.nodeId));

    const campaigns: BranchMapCampaignOverlay[] = [];
    const wiki: BranchMapWikiOverlay[] = [];
    const processOverlays = (rawValues: unknown, type: 'campaign' | 'wiki', target: BranchMapCampaignOverlay[] | BranchMapWikiOverlay[]) => {
      if (rawValues === undefined) return;
      if (!Array.isArray(rawValues)) { errors.push(`input.${type}Overlays must be an array`); return; }
      for (const raw of rawValues) {
        const result = validateOverlay(raw, `input.${type}Overlays[]`, type);
        if (!result.valid || !result.value) { gaps.push(gap('unknown', 'unknown_overlay', null, null, result.errors.join('; '))); continue; }
        const overlay = result.value;
        if (!branchesById.has(overlay.branchId)) { gaps.push(gap('unknown', 'unknown_overlay', overlay.branchId, null, `${type} overlay ${overlay.overlayId} references unknown branch`)); continue; }
        if (target.some((existing) => existing.overlayId === overlay.overlayId)) { gaps.push(gap('unknown', 'unknown_overlay', overlay.branchId, null, `duplicate ${type} overlay ${overlay.overlayId}`)); continue; }
        target.push(overlay as never);
        if (overlay.status === 'pending' || overlay.status === 'claimed-paused') gaps.push(gap('pending', 'pending_overlay', overlay.branchId, null, `${type} overlay ${overlay.overlayId} is ${overlay.status}`));
        if (overlay.status === 'unknown' || overlay.status === 'missing' || overlay.status === 'stale' || overlay.freshness === 'stale' || overlay.freshness === 'unverified') gaps.push(gap('unknown', 'unknown_overlay', overlay.branchId, null, `${type} overlay ${overlay.overlayId} is ${overlay.status}/${overlay.freshness}`));
      }
    };
    processOverlays(input.campaignOverlays, 'campaign', campaigns);
    processOverlays(input.wikiOverlays, 'wiki', wiki);
    if (errors.length) return { accepted: false, status: 'rejected', errors };
    campaigns.sort((a, b) => compare(a.overlayId, b.overlayId));
    wiki.sort((a, b) => compare(a.overlayId, b.overlayId));

    const branches: BranchMapBranch[] = [...branchesById.values()].sort((a, b) => compare(a.branchId, b.branchId)).map((branch) => {
      const branchNodes = mappedNodes.filter((node) => node.branchId === branch.branchId).sort((a, b) => compare(a.nodeId, b.nodeId));
      return {
        branchId: branch.branchId,
        label: branch.label,
        nodeIds: branchNodes.map((node) => node.nodeId),
        authoritativeStatus: aggregateStatus(branchNodes),
        campaignOverlays: campaigns.filter((overlay) => overlay.branchId === branch.branchId),
        wikiOverlays: wiki.filter((overlay) => overlay.branchId === branch.branchId),
      };
    });
    gaps.sort((a, b) => compare(a.gapId, b.gapId));
    const body: Omit<BranchMapProjection, 'projectionDigest'> = {
      schema: BRANCH_MAP_PROJECTION_SCHEMA,
      version: BRANCH_MAP_PROJECTION_VERSION,
      versionLabel: BRANCH_MAP_PROJECTION_VERSION_LABEL,
      tenantId,
      graphVersion,
      graphDigest,
      generatedAt,
      sourceRef,
      nodes: mappedNodes.sort((a, b) => compare(a.nodeId, b.nodeId)),
      branches,
      receipts,
      lineage: lineageValues,
      overlays: { campaigns, wiki },
      gaps,
    };
    return { accepted: true, status: 'accepted', projection: { ...body, projectionDigest: `sha256:${sha256(stableJson(body))}` } };
  } catch (error) {
    return { accepted: false, status: 'rejected', errors: [error instanceof Error ? error.message : 'invalid branch map input'] };
  }
}

export const createBranchMapProjection = buildBranchMapProjection;
export const projectBranchMap = buildBranchMapProjection;

/** Minimal packet shape accepted by the branch-to-organ adapter. It mirrors
 * the stable fields emitted by BranchStoryArc without importing the parser or
 * granting packets write authority. */
export interface BranchMapPacketOrganInput {
  organ: string;
  owner?: string;
  input?: string;
  output?: string;
  proofPath?: string;
  currentGate?: string;
}

export interface BranchMapPacketInput {
  branchId: string;
  label: string;
  branchKind: string;
  promotionState: string;
  currentGate: string;
  sourceRef: string;
  sourceDigest: string;
  organRouting: readonly BranchMapPacketOrganInput[];
}

export interface BranchMapPacketProjectionInput {
  tenantId: string;
  graphVersion: number;
  graphDigest: string;
  generatedAt: string;
  sourceRef: string;
  packets: readonly BranchMapPacketInput[];
  receipts?: readonly BranchMapReceipt[];
  campaignOverlays?: readonly BranchMapCampaignOverlay[];
  wikiOverlays?: readonly BranchMapWikiOverlay[];
}

function packetSlug(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'organ';
}

function packetStatus(promotionState: string): GoalNodeStatus {
  if (promotionState === 'supervised-branch' || promotionState === 'autonomous-branch' || promotionState === 'organ-service') return 'active';
  return 'draft';
}

/** Compile packet metadata and Organ Routing into stable Goal Graph-shaped
 * nodes. No receipt is invented: absent receipts remain pending gaps when the
 * resulting input is folded by buildBranchMapProjection. */
export function branchMapInputFromPackets(input: BranchMapPacketProjectionInput): BranchMapProjectionInput {
  const nodes: GoalGraphNode[] = [];
  const branches: BranchMapBranchInput[] = [];
  const lineage: BranchMapLineage[] = [];
  const branchIds = new Set<string>();
  const generatedAt = bounded(input.generatedAt, 'packets.generatedAt');
  if (Number.isNaN(Date.parse(generatedAt))) throw new Error('packets.generatedAt must be an ISO date');
  for (const packet of [...input.packets].sort((a, b) => compare(a.branchId, b.branchId))) {
    const branchId = bounded(packet.branchId, 'packet.branchId');
    if (branchIds.has(branchId)) throw new Error(`duplicate packet branch ${branchId}`);
    branchIds.add(branchId);
    const rootNodeId = `branch:${branchId}`;
    const rootStatus = packetStatus(packet.promotionState);
    const rootSourceRef = bounded(packet.sourceRef, `${branchId}.sourceRef`);
    const rootDigest = bounded(packet.sourceDigest, `${branchId}.sourceDigest`);
    const nodeIds = [rootNodeId];
    nodes.push({
      nodeId: rootNodeId,
      tenantId: input.tenantId,
      namespace: branchId,
      externalId: null,
      parentNodeId: null,
      scope: 'macro',
      desiredState: packet.currentGate,
      currentState: packet.promotionState,
      owner: 'branch-packet',
      nextAction: packet.currentGate,
      waitCondition: null,
      proofRequired: true,
      reviewAt: null,
      status: rootStatus,
      sourceRef: rootSourceRef,
      sourceDigest: rootDigest,
      graphVersion: input.graphVersion,
      metadata: { branchKind: packet.branchKind, promotionState: packet.promotionState },
      createdAt: generatedAt,
      updatedAt: generatedAt,
    });
    lineage.push({ nodeId: rootNodeId, tenantId: input.tenantId, branchId, parentNodeId: null, rootNodeId, sourceRef: rootSourceRef, sourceDigest: rootDigest });
    for (const organ of [...packet.organRouting].sort((a, b) => compare(a.organ, b.organ))) {
      const organSlug = packetSlug(organ.organ);
      const nodeId = `${rootNodeId}:organ:${organSlug}`;
      const sourceRef = `${rootSourceRef}#organ=${organSlug}`;
      const sourceDigest = `sha256:${sha256(`${rootDigest}:${organSlug}`)}`;
      nodeIds.push(nodeId);
      nodes.push({
        nodeId,
        tenantId: input.tenantId,
        namespace: branchId,
        externalId: null,
        parentNodeId: rootNodeId,
        scope: 'meso',
        desiredState: organ.currentGate || packet.currentGate,
        currentState: 'packet-declared',
        owner: organ.owner || 'branch-packet',
        nextAction: organ.proofPath || null,
        waitCondition: organ.currentGate || null,
        proofRequired: true,
        reviewAt: null,
        status: 'draft',
        sourceRef,
        sourceDigest,
        graphVersion: input.graphVersion,
        metadata: { organ: organ.organ, input: organ.input || '', output: organ.output || '' },
        createdAt: generatedAt,
        updatedAt: generatedAt,
      });
      lineage.push({ nodeId, tenantId: input.tenantId, branchId, parentNodeId: rootNodeId, rootNodeId, sourceRef, sourceDigest });
    }
    branches.push({ branchId, label: packet.label, nodeIds });
  }
  return {
    tenantId: input.tenantId,
    graphVersion: input.graphVersion,
    graphDigest: input.graphDigest,
    generatedAt,
    sourceRef: input.sourceRef,
    nodes,
    branches,
    lineage,
    receipts: input.receipts || [],
    campaignOverlays: input.campaignOverlays,
    wikiOverlays: input.wikiOverlays,
  };
}

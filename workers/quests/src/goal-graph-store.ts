/**
 * The D1 Goal Graph authority.
 *
 * Proposals are pure values (see goal-graph/compiler.ts).  This module is the
 * deliberately small persistence boundary: reads are tenant scoped and a
 * commit is one conditional, approval-bound D1 batch.  There is intentionally
 * no non-batch fallback.  A database which cannot provide a transaction is
 * not an authority database.
 */

import { makeGoalGraphHead } from './goal-graph/compiler.ts';
import { sha256 } from './goal-graph/identity.ts';
import type {
  GoalChangeSet,
  GoalGraphHead,
  GoalGraphNode,
  GoalGraphUpdate,
} from './goal-graph/types.ts';

export interface GoalGraphD1StatementLike {
  bind(...values: unknown[]): GoalGraphD1StatementLike;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results?: T[] }>;
  run(): Promise<{ meta?: { changes?: number } }>;
}

/** D1's batch is optional in the structural type so we can fail closed. */
export interface GoalGraphD1DatabaseLike {
  prepare(sql: string): GoalGraphD1StatementLike;
  batch?: (statements: GoalGraphD1StatementLike[]) => Promise<unknown[]>;
}

/**
 * Approval fields use the repository's camelCase contract.  A few wire
 * aliases are accepted by the implementation as a migration convenience, but
 * the canonical value persisted in D1 always uses the fields below.
 */
export interface GoalGraphApproval {
  tenantId: string;
  changeDigest: string;
  intentVersion: number;
  approverId: string;
  decision: 'approved' | 'rejected';
  expiresAt: string;
  nonce: string;
  approvalDigest?: string;
  /** Optional caller-supplied canonical bytes. They must match our bytes. */
  canonical?: string;
  decidedAt?: string;
  /** Compatibility aliases used by older adapter envelopes. */
  tenant_id?: string;
  change_digest?: string;
  intent_version?: number;
  approver_id?: string;
  expires_at?: string;
  approval_nonce?: string;
  approval_digest?: string;
  canonical_json?: string;
}

export interface GoalGraphCommitInput {
  tenantId: string;
  changeSet: GoalChangeSet;
  approval: GoalGraphApproval;
  /** Optional explicit intent version when the envelope carries it outside approval. */
  intentVersion?: number;
  /** Injectable clock for deterministic callers/tests. */
  now?: string;
  /** Optional event identity. The default is deterministic from tenant/change. */
  eventId?: string;
}

export type GoalGraphCommitResult =
  | {
      status: 'committed';
      replayed: false;
      changeDigest: string;
      head: GoalGraphHead;
    }
  | {
      status: 'duplicate';
      replayed: true;
      changeDigest: string;
      head: GoalGraphHead;
    }
  | {
      status: 'stale';
      replayed: false;
      changeDigest: string;
      expectedHeadDigest: string | null;
      actualHeadDigest: string | null;
      head: GoalGraphHead | null;
    }
  | {
      status: 'rejected' | 'unavailable';
      replayed: false;
      changeDigest: string | null;
      code: string;
      head?: GoalGraphHead | null;
    };

export interface GoalGraphStoreLike {
  readHead(tenantId: string): Promise<GoalGraphHead | null>;
  readNodes(tenantId: string): Promise<GoalGraphNode[]>;
  commit(input: GoalGraphCommitInput): Promise<GoalGraphCommitResult>;
}

interface HeadRow {
  tenant_id: string;
  graph_version: number;
  graph_digest: string;
  source_ref: string | null;
  source_digest: string | null;
  committed_at: string;
}

interface NodeRow {
  tenant_id: string;
  node_id: string;
  namespace: string;
  external_id: string | null;
  parent_node_id: string | null;
  work_object_id: string | null;
  work_object_kind: GoalGraphNode['workObjectKind'];
  pinned_loadout_id: string | null;
  scope: GoalGraphNode['scope'];
  desired_state: string;
  current_state: string;
  owner: string;
  next_action: string | null;
  wait_condition: string | null;
  proof_required: number | boolean;
  review_at: string | null;
  status: GoalGraphNode['status'];
  source_ref: string;
  source_digest: string;
  graph_version: number;
  metadata_json: string;
  created_at: string;
  updated_at: string;
}

interface EventRow {
  event_id: string;
  tenant_id: string;
  graph_version: number;
  graph_digest: string;
  change_digest: string;
}

const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const DIGEST_RE = /^(?:sha256:)?[a-f0-9]{64}$/;
const SAFE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(',')}}`;
}

function parseJson<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as T : null;
  } catch {
    return null;
  }
}

function normalizeApproval(input: GoalGraphApproval): {
  tenantId: string;
  changeDigest: string;
  intentVersion: number;
  approverId: string;
  decision: string;
  expiresAt: string;
  nonce: string;
  canonicalProvided: string | undefined;
  approvalDigest: string;
  decidedAt: string | undefined;
} {
  const value = input as GoalGraphApproval & Record<string, unknown>;
  return {
    tenantId: typeof value.tenantId === 'string' ? value.tenantId : String(value.tenant_id ?? ''),
    changeDigest: typeof value.changeDigest === 'string' ? value.changeDigest : String(value.change_digest ?? ''),
    intentVersion: Number.isInteger(value.intentVersion) ? Number(value.intentVersion) : Number(value.intent_version),
    approverId: typeof value.approverId === 'string' ? value.approverId : String(value.approver_id ?? ''),
    decision: typeof value.decision === 'string' ? value.decision : '',
    expiresAt: typeof value.expiresAt === 'string' ? value.expiresAt : String(value.expires_at ?? ''),
    nonce: typeof value.nonce === 'string' ? value.nonce : String(value.approval_nonce ?? ''),
    canonicalProvided: typeof value.canonical === 'string' ? value.canonical : typeof value.canonical_json === 'string' ? value.canonical_json : undefined,
    approvalDigest: typeof value.approvalDigest === 'string' ? value.approvalDigest : String(value.approval_digest ?? ''),
    decidedAt: typeof value.decidedAt === 'string' ? value.decidedAt : typeof value.decided_at === 'string' ? value.decided_at : undefined,
  };
}

/** Canonical bytes that approval signatures/receipts must bind to. */
export function canonicalizeGoalGraphApproval(input: Pick<GoalGraphApproval, 'tenantId' | 'changeDigest' | 'intentVersion' | 'approverId' | 'expiresAt' | 'nonce'>): string {
  return stableJson({
    approverId: input.approverId,
    changeDigest: input.changeDigest,
    expiresAt: input.expiresAt,
    intentVersion: input.intentVersion,
    nonce: input.nonce,
    tenantId: input.tenantId,
  });
}

export const serializeGoalGraphApproval = canonicalizeGoalGraphApproval;

export function goalGraphApprovalDigest(input: Pick<GoalGraphApproval, 'tenantId' | 'changeDigest' | 'intentVersion' | 'approverId' | 'expiresAt' | 'nonce'>): string {
  return sha256(canonicalizeGoalGraphApproval(input));
}

function rowToNode(row: NodeRow): GoalGraphNode | null {
  const metadata = parseJson<Record<string, unknown>>(row.metadata_json);
  if (!metadata) return null;
  return {
    nodeId: row.node_id,
    tenantId: row.tenant_id,
    namespace: row.namespace,
    externalId: row.external_id,
    parentNodeId: row.parent_node_id,
    workObjectId: row.work_object_id,
    workObjectKind: row.work_object_kind,
    pinnedLoadoutId: row.pinned_loadout_id,
    scope: row.scope,
    desiredState: row.desired_state,
    currentState: row.current_state,
    owner: row.owner,
    nextAction: row.next_action,
    waitCondition: row.wait_condition,
    proofRequired: row.proof_required === true || Number(row.proof_required) === 1,
    reviewAt: row.review_at,
    status: row.status,
    sourceRef: row.source_ref,
    sourceDigest: row.source_digest,
    graphVersion: Number(row.graph_version),
    metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToHead(row: HeadRow | null, nodeIds: readonly string[] = []): GoalGraphHead | null {
  if (!row) return null;
  return {
    tenantId: row.tenant_id,
    graphVersion: Number(row.graph_version),
    graphDigest: row.graph_digest,
    nodeIds: [...nodeIds],
    sourceRef: row.source_ref,
    sourceDigest: row.source_digest,
    committedAt: row.committed_at,
  };
}

function nodeValues(node: GoalGraphNode): unknown[] {
  return [
    node.tenantId,
    node.nodeId,
    node.namespace,
    node.externalId,
    node.parentNodeId,
    node.workObjectId ?? null,
    node.workObjectKind ?? null,
    node.pinnedLoadoutId ?? null,
    node.scope,
    node.desiredState,
    node.currentState,
    node.owner,
    node.nextAction,
    node.waitCondition,
    node.proofRequired ? 1 : 0,
    node.reviewAt,
    node.status,
    node.sourceRef,
    node.sourceDigest,
    node.graphVersion,
    stableJson(node.metadata),
    node.createdAt,
    node.updatedAt,
  ];
}

function nodeDepth(node: GoalGraphNode, byId: Map<string, GoalGraphNode>, seen = new Set<string>()): number {
  if (!node.parentNodeId) return 0;
  if (seen.has(node.nodeId)) return 0;
  seen.add(node.nodeId);
  const parent = byId.get(node.parentNodeId);
  return parent ? nodeDepth(parent, byId, seen) + 1 : 0;
}

function orderedCreates(nodes: readonly GoalGraphNode[]): GoalGraphNode[] {
  const byId = new Map(nodes.map((node) => [node.nodeId, node]));
  return [...nodes].sort((a, b) => nodeDepth(a, byId) - nodeDepth(b, byId) || a.nodeId.localeCompare(b.nodeId));
}

function orderedRemovals(nodes: readonly GoalGraphNode[]): GoalGraphNode[] {
  const byId = new Map(nodes.map((node) => [node.nodeId, node]));
  return [...nodes].sort((a, b) => nodeDepth(b, byId) - nodeDepth(a, byId) || a.nodeId.localeCompare(b.nodeId));
}

function targetNodes(current: readonly GoalGraphNode[], changeSet: GoalChangeSet): GoalGraphNode[] {
  const byId = new Map(current.map((node) => [node.nodeId, node]));
  for (const node of changeSet.nodesToRemove) byId.delete(node.nodeId);
  for (const update of changeSet.nodesToUpdate) byId.set(update.nodeId, update.after);
  for (const node of changeSet.nodesToCreate) byId.set(node.nodeId, node);
  return [...byId.values()].sort((a, b) => a.nodeId.localeCompare(b.nodeId));
}

function expectedHeadDigest(changeSet: GoalChangeSet): string | null {
  return changeSet.expectedHeadDigest ?? null;
}

function resultRejected(code: string, changeDigest: string | null = null): GoalGraphCommitResult {
  return { status: 'rejected', replayed: false, changeDigest, code };
}

export function d1GoalGraphStore(db: GoalGraphD1DatabaseLike): GoalGraphStoreLike {
  async function readHeadRow(tenantId: string): Promise<HeadRow | null> {
    return db.prepare(`
      SELECT tenant_id, graph_version, graph_digest, source_ref, source_digest, committed_at
      FROM goal_graph_heads
      WHERE tenant_id = ?
    `).bind(tenantId).first<HeadRow>();
  }

  async function readNodeRows(tenantId: string): Promise<NodeRow[]> {
    const result = await db.prepare(`
      SELECT tenant_id, node_id, namespace, external_id, parent_node_id,
        work_object_id, work_object_kind, pinned_loadout_id,
        scope, desired_state, current_state, owner, next_action, wait_condition,
        proof_required, review_at, status, source_ref, source_digest,
        graph_version, metadata_json, created_at, updated_at
      FROM goal_graph_nodes
      WHERE tenant_id = ?
      ORDER BY node_id ASC
    `).bind(tenantId).all<NodeRow>();
    return result.results ?? [];
  }

  async function readEvent(tenantId: string, changeDigest: string): Promise<EventRow | null> {
    return db.prepare(`
      SELECT event_id, tenant_id, graph_version, graph_digest, change_digest
      FROM goal_graph_events
      WHERE tenant_id = ? AND change_digest = ?
    `).bind(tenantId, changeDigest).first<EventRow>();
  }

  async function readHead(tenantId: string): Promise<GoalGraphHead | null> {
    const row = await readHeadRow(tenantId);
    if (!row) return null;
    const rows = await readNodeRows(tenantId);
    return rowToHead(row, rows.map((node) => node.node_id));
  }

  async function readNodes(tenantId: string): Promise<GoalGraphNode[]> {
    const rows = await readNodeRows(tenantId);
    const nodes = rows.map(rowToNode);
    // Corrupt JSON is not a useful read model. Return no partial authority.
    if (nodes.some((node) => node === null)) return [];
    return nodes as GoalGraphNode[];
  }

  async function commit(input: GoalGraphCommitInput): Promise<GoalGraphCommitResult> {
    const changeSet = input?.changeSet;
    const changeDigest = typeof changeSet?.changeDigest === 'string' ? changeSet.changeDigest : null;
    if (!changeSet || !changeDigest) return resultRejected('change_set_invalid', changeDigest);
    if (typeof input.tenantId !== 'string' || input.tenantId.length === 0 || changeSet.tenantId !== input.tenantId) {
      return resultRejected('tenant_mismatch', changeDigest);
    }
    if (!input.approval || typeof input.approval !== 'object') return resultRejected('approval_required', changeDigest);
    const approval = normalizeApproval(input.approval);
    const intentVersion = input.intentVersion ?? approval.intentVersion;
    const now = input.now ?? new Date().toISOString();
    if (!ISO_TIMESTAMP_RE.test(now) || !Number.isFinite(Date.parse(now))) return resultRejected('commit_time_invalid', changeDigest);
    if (approval.tenantId !== input.tenantId) return resultRejected('approval_tenant_mismatch', changeDigest);
    if (approval.changeDigest !== changeDigest) return resultRejected('approval_digest_mismatch', changeDigest);
    if (!Number.isInteger(intentVersion) || intentVersion < 1 || approval.intentVersion !== intentVersion) return resultRejected('approval_intent_version_mismatch', changeDigest);
    if (!SAFE_ID_RE.test(approval.approverId)) return resultRejected('approval_approver_invalid', changeDigest);
    if (approval.decision !== 'approved') return resultRejected('approval_not_approved', changeDigest);
    if (!SAFE_ID_RE.test(approval.nonce)) return resultRejected('approval_nonce_invalid', changeDigest);
    if (!ISO_TIMESTAMP_RE.test(approval.expiresAt) || !Number.isFinite(Date.parse(approval.expiresAt)) || Date.parse(approval.expiresAt) <= Date.parse(now)) return resultRejected('approval_expired', changeDigest);
    if (approval.decidedAt !== undefined && (!ISO_TIMESTAMP_RE.test(approval.decidedAt) || Date.parse(approval.decidedAt) > Date.parse(now))) return resultRejected('approval_time_invalid', changeDigest);
    const canonicalApproval = canonicalizeGoalGraphApproval({
      tenantId: approval.tenantId,
      changeDigest: approval.changeDigest,
      intentVersion,
      approverId: approval.approverId,
      expiresAt: approval.expiresAt,
      nonce: approval.nonce,
    });
    if (approval.canonicalProvided !== undefined && approval.canonicalProvided !== canonicalApproval) return resultRejected('approval_canonical_mismatch', changeDigest);
    const suppliedApprovalDigest = approval.approvalDigest;
    const expectedApprovalDigest = goalGraphApprovalDigest({
      tenantId: approval.tenantId,
      changeDigest: approval.changeDigest,
      intentVersion,
      approverId: approval.approverId,
      expiresAt: approval.expiresAt,
      nonce: approval.nonce,
    });
    if (suppliedApprovalDigest !== expectedApprovalDigest) return resultRejected('approval_digest_invalid', changeDigest);
    if (!DIGEST_RE.test(changeDigest)) return resultRejected('change_digest_invalid', changeDigest);

    const expectedDigest = expectedHeadDigest(changeSet);
    const currentHead = await readHeadRow(input.tenantId);
    const currentRows = await readNodeRows(input.tenantId);
    const currentNodes = currentRows.map(rowToNode);
    if (currentNodes.some((node) => node === null)) return resultRejected('graph_corrupt', changeDigest);
    const concreteCurrentNodes = currentNodes as GoalGraphNode[];

    // An existing event is the durable replay marker. Validate its target
    // before returning duplicate so an inconsistent event cannot masquerade as
    // a successful readback.
    const existingEvent = await readEvent(input.tenantId, changeDigest);
    if (existingEvent) {
      if (!currentHead || currentHead.graph_digest !== existingEvent.graph_digest) return resultRejected('graph_event_inconsistent', changeDigest);
      const head = rowToHead(currentHead, currentRows.map((node) => node.node_id));
      return { status: 'duplicate', replayed: true, changeDigest, head: head! };
    }

    if (!Array.isArray(changeSet.nodesToCreate) || !Array.isArray(changeSet.nodesToUpdate) || !Array.isArray(changeSet.nodesToRemove)) {
      return resultRejected('change_set_invalid', changeDigest);
    }
    const allChanged = [
      ...changeSet.nodesToCreate,
      ...changeSet.nodesToRemove,
      ...changeSet.nodesToUpdate.flatMap((update: GoalGraphUpdate) => [update.before, update.after]),
    ];
    if (allChanged.some((node) => !node || node.tenantId !== input.tenantId || !SAFE_ID_RE.test(node.nodeId))) return resultRejected('node_tenant_mismatch', changeDigest);
    const nextNodes = targetNodes(concreteCurrentNodes, changeSet);
    const nextHead = makeGoalGraphHead(input.tenantId, nextNodes, changeSet.graphVersion, now, changeSet.sourceRef, changeSet.sourceDigest);
    const eventId = input.eventId ?? `goal-graph:${input.tenantId}:${changeDigest}`;
    if (!SAFE_ID_RE.test(eventId)) return resultRejected('event_id_invalid', changeDigest);

    if (typeof db.batch !== 'function') {
      return { status: 'unavailable', replayed: false, changeDigest, code: 'batch_required' };
    }

    const approvalJson = stableJson({
      canonical: canonicalApproval,
      decision: approval.decision,
      expiresAt: approval.expiresAt,
      intentVersion,
      nonce: approval.nonce,
      approverId: approval.approverId,
      tenantId: approval.tenantId,
    });
    const guard = `
      EXISTS (
        SELECT 1 FROM goal_graph_heads h
        JOIN goal_graph_approvals a ON a.tenant_id = h.tenant_id
          AND a.change_digest = ? AND a.nonce = ?
        WHERE h.tenant_id = ? AND h.graph_digest = ?
      )`;
    const statements: GoalGraphD1StatementLike[] = [];

    // Approval is the first write and is itself conditional on the expected
    // head. This gives every later statement a durable CAS witness. A stale
    // transaction therefore cannot leave an approval behind.
    statements.push(db.prepare(`
      INSERT INTO goal_graph_approvals (
        approval_id, tenant_id, change_digest, intent_version, approver_id,
        decision, expires_at, nonce, canonical_json, decided_at, recorded_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE (
        (? IS NULL AND NOT EXISTS (SELECT 1 FROM goal_graph_heads WHERE tenant_id = ?))
        OR (? IS NOT NULL AND EXISTS (
          SELECT 1 FROM goal_graph_heads WHERE tenant_id = ? AND graph_digest = ?
        ))
      )
    `).bind(
      `approval:${input.tenantId}:${changeDigest}:${approval.nonce}`,
      input.tenantId,
      changeDigest,
      intentVersion,
      approval.approverId,
      approval.decision,
      approval.expiresAt,
      approval.nonce,
      approvalJson,
      approval.decidedAt ?? now,
      now,
      expectedDigest,
      input.tenantId,
      expectedDigest,
      input.tenantId,
      expectedDigest,
    ));

    // Bootstrap is an INSERT; established revisions use a conditional UPDATE.
    // Both statements are harmless no-ops for the opposite path.
    statements.push(db.prepare(`
      INSERT INTO goal_graph_heads (
        tenant_id, graph_version, graph_digest, source_ref, source_digest, committed_at, updated_at
      )
      SELECT ?, ?, ?, ?, ?, ?, ?
      WHERE ? IS NULL
        AND EXISTS (
          SELECT 1 FROM goal_graph_approvals
          WHERE tenant_id = ? AND change_digest = ? AND nonce = ?
        )
        AND NOT EXISTS (SELECT 1 FROM goal_graph_heads WHERE tenant_id = ?)
    `).bind(
      input.tenantId,
      nextHead.graphVersion,
      nextHead.graphDigest,
      nextHead.sourceRef,
      nextHead.sourceDigest,
      nextHead.committedAt,
      now,
      expectedDigest,
      input.tenantId,
      changeDigest,
      approval.nonce,
      input.tenantId,
    ));
    statements.push(db.prepare(`
      UPDATE goal_graph_heads
      SET graph_version = ?, graph_digest = ?, source_ref = ?, source_digest = ?, committed_at = ?, updated_at = ?
      WHERE tenant_id = ? AND graph_digest = ?
        AND EXISTS (
          SELECT 1 FROM goal_graph_approvals
          WHERE tenant_id = ? AND change_digest = ? AND nonce = ?
        )
    `).bind(
      nextHead.graphVersion,
      nextHead.graphDigest,
      nextHead.sourceRef,
      nextHead.sourceDigest,
      nextHead.committedAt,
      now,
      input.tenantId,
      expectedDigest,
      input.tenantId,
      changeDigest,
      approval.nonce,
    ));

    const guardArgs = [changeDigest, approval.nonce, input.tenantId, nextHead.graphDigest];
    for (const removed of orderedRemovals(changeSet.nodesToRemove)) {
      statements.push(db.prepare(`
        DELETE FROM goal_graph_nodes
        WHERE tenant_id = ? AND node_id = ? AND ${guard}
      `).bind(input.tenantId, removed.nodeId, ...guardArgs));
    }
    for (const update of changeSet.nodesToUpdate) {
      const node = update.after;
      statements.push(db.prepare(`
        UPDATE goal_graph_nodes SET
          namespace = ?, external_id = ?, parent_node_id = ?, work_object_id = ?, work_object_kind = ?,
          pinned_loadout_id = ?, scope = ?, desired_state = ?, current_state = ?,
          owner = ?, next_action = ?, wait_condition = ?, proof_required = ?, review_at = ?, status = ?,
          source_ref = ?, source_digest = ?, graph_version = ?, metadata_json = ?, updated_at = ?
        WHERE tenant_id = ? AND node_id = ? AND ${guard}
      `).bind(
        node.namespace,
        node.externalId,
        node.parentNodeId,
        node.workObjectId ?? null,
        node.workObjectKind ?? null,
        node.pinnedLoadoutId ?? null,
        node.scope,
        node.desiredState,
        node.currentState,
        node.owner,
        node.nextAction,
        node.waitCondition,
        node.proofRequired ? 1 : 0,
        node.reviewAt,
        node.status,
        node.sourceRef,
        node.sourceDigest,
        node.graphVersion,
        stableJson(node.metadata),
        node.updatedAt,
        input.tenantId,
        node.nodeId,
        ...guardArgs,
      ));
    }
    for (const node of orderedCreates(changeSet.nodesToCreate)) {
      statements.push(db.prepare(`
        INSERT INTO goal_graph_nodes (
          tenant_id, node_id, namespace, external_id, parent_node_id, work_object_id, work_object_kind,
          pinned_loadout_id, scope, desired_state, current_state,
          owner, next_action, wait_condition, proof_required, review_at, status, source_ref, source_digest,
          graph_version, metadata_json, created_at, updated_at
        )
        SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        WHERE ${guard}
      `).bind(...nodeValues(node), ...guardArgs));
    }

    const eventPayload = stableJson({
      changeDigest,
      createdNodeIds: changeSet.nodesToCreate.map((node) => node.nodeId).sort(),
      removedNodeIds: changeSet.nodesToRemove.map((node) => node.nodeId).sort(),
      updatedNodeIds: changeSet.nodesToUpdate.map((update) => update.nodeId).sort(),
      sourceDigest: changeSet.sourceDigest,
      sourceRef: changeSet.sourceRef,
    });
    statements.push(db.prepare(`
      INSERT INTO goal_graph_events (
        event_id, tenant_id, event_type, graph_version, graph_digest, change_digest, payload_json, recorded_at
      )
      SELECT ?, ?, 'graph_committed', ?, ?, ?, ?, ?
      WHERE ${guard}
    `).bind(eventId, input.tenantId, nextHead.graphVersion, nextHead.graphDigest, changeDigest, eventPayload, now, ...guardArgs));

    try {
      await db.batch(statements);
    } catch {
      // D1 rolls a failed batch back. Do not attempt a partial-write repair;
      // callers receive a fail-closed conflict and can reconcile by reading.
      return resultRejected('commit_batch_failed', changeDigest);
    }

    const afterRow = await readHeadRow(input.tenantId);
    const afterNodes = await readNodeRows(input.tenantId);
    const afterHead = rowToHead(afterRow, afterNodes.map((node) => node.node_id));
    const afterEvent = await readEvent(input.tenantId, changeDigest);
    if (afterEvent && afterHead && afterHead.graphDigest === nextHead.graphDigest) {
      const replayed = expectedDigest !== null
        ? currentHead?.graph_digest !== expectedDigest
        : currentHead !== null;
      if (replayed) return { status: 'duplicate', replayed: true, changeDigest, head: afterHead };
      return { status: 'committed', replayed: false, changeDigest, head: afterHead };
    }
    if (!afterHead || afterHead.graphDigest !== expectedDigest) {
      return {
        status: 'stale',
        replayed: false,
        changeDigest,
        expectedHeadDigest: expectedDigest,
        actualHeadDigest: afterHead?.graphDigest ?? null,
        head: afterHead,
      };
    }
    return resultRejected('commit_not_observed', changeDigest);
  }

  return { readHead, readNodes, commit };
}

export const createGoalGraphStore = d1GoalGraphStore;

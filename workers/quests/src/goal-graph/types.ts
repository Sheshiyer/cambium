/** Durable, tenant-scoped Goal Graph domain contracts. */

export type GoalNodeStatus = 'draft' | 'active' | 'blocked' | 'paused' | 'retired';

export interface GoalGraphNode {
  nodeId: string;
  tenantId: string;
  namespace: string;
  externalId: string | null;
  parentNodeId: string | null;
  scope: 'macro' | 'meso' | 'micro' | 'proof';
  desiredState: string;
  currentState: string;
  owner: string;
  nextAction: string | null;
  waitCondition: string | null;
  proofRequired: boolean;
  reviewAt: string | null;
  status: GoalNodeStatus;
  sourceRef: string;
  sourceDigest: string;
  graphVersion: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface GoalGraphHead {
  tenantId: string;
  graphVersion: number;
  graphDigest: string;
  nodeIds: readonly string[];
  sourceRef: string | null;
  sourceDigest: string | null;
  committedAt: string;
}

export interface GoalGraphUpdate {
  nodeId: string;
  before: GoalGraphNode;
  after: GoalGraphNode;
}

export interface GoalChangeSet {
  tenantId: string;
  expectedHeadDigest: string | null;
  graphVersion: number;
  nodesToCreate: readonly GoalGraphNode[];
  nodesToUpdate: readonly GoalGraphUpdate[];
  nodesToRemove: readonly GoalGraphNode[];
  changeDigest: string;
  isNoop: boolean;
  sourceRef: string;
  sourceDigest: string;
}

export interface GoalGraphInputNode extends Omit<GoalGraphNode, 'nodeId' | 'createdAt' | 'updatedAt'> {
  nodeId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface GoalGraphCompileInput {
  tenantId: string;
  expectedHeadDigest: string | null;
  actualHead: GoalGraphHead | null;
  currentNodes: readonly GoalGraphNode[];
  proposedNodes: readonly GoalGraphInputNode[];
  graphVersion: number;
  sourceRef: string;
  sourceDigest: string;
  now?: string;
}

export type GoalGraphCompileResult =
  | { status: 'compiled'; changeSet: GoalChangeSet }
  | { status: 'stale'; expectedHeadDigest: string | null; actualHeadDigest: string | null };

export type GoalGraphEventType = 'graph_proposed' | 'graph_committed' | 'node_created' | 'node_updated' | 'node_retired';

export interface GoalGraphEvent {
  eventId: string;
  tenantId: string;
  eventType: GoalGraphEventType;
  graphVersion: number;
  graphDigest: string;
  changeDigest: string;
  payload: Record<string, unknown>;
  recordedAt: string;
}

export type GraphMigrationClass = 'unchanged' | 'replaced' | 'retired' | 'split' | 'merged' | 'unmapped';

export interface GoalGraphMigrationMapping {
  fromNodeIds: readonly string[];
  toNodeIds: readonly string[];
  classification: GraphMigrationClass;
  proofDisposition: 'preserve' | 'revalidate' | 'retire' | 'review_required';
  reviewRequired: boolean;
}

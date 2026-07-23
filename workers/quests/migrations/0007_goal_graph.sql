-- Durable tenant-scoped Goal Graph authority. Proposals and projections never
-- write these tables directly; commits must compare the expected graph digest.

CREATE TABLE IF NOT EXISTS goal_graph_heads (
  tenant_id TEXT PRIMARY KEY,
  graph_version INTEGER NOT NULL CHECK (graph_version >= 0),
  graph_digest TEXT NOT NULL,
  source_ref TEXT,
  source_digest TEXT,
  committed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS goal_graph_nodes (
  tenant_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  namespace TEXT NOT NULL,
  external_id TEXT,
  parent_node_id TEXT,
  scope TEXT NOT NULL CHECK (scope IN ('macro', 'meso', 'micro', 'proof')),
  desired_state TEXT NOT NULL,
  current_state TEXT NOT NULL,
  owner TEXT NOT NULL,
  next_action TEXT,
  wait_condition TEXT,
  proof_required INTEGER NOT NULL CHECK (proof_required IN (0, 1)),
  review_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'blocked', 'paused', 'retired')),
  source_ref TEXT NOT NULL,
  source_digest TEXT NOT NULL,
  graph_version INTEGER NOT NULL CHECK (graph_version >= 0),
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, node_id),
  FOREIGN KEY (tenant_id) REFERENCES goal_graph_heads(tenant_id),
  FOREIGN KEY (tenant_id, parent_node_id) REFERENCES goal_graph_nodes(tenant_id, node_id),
  CHECK (json_valid(metadata_json))
);

CREATE INDEX IF NOT EXISTS idx_goal_graph_nodes_parent
  ON goal_graph_nodes (tenant_id, parent_node_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_goal_graph_singleton_root
  ON goal_graph_nodes (tenant_id)
  WHERE parent_node_id IS NULL;

CREATE TABLE IF NOT EXISTS goal_graph_events (
  event_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('graph_proposed', 'graph_committed', 'node_created', 'node_updated', 'node_retired')),
  graph_version INTEGER NOT NULL,
  graph_digest TEXT NOT NULL,
  change_digest TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  UNIQUE (tenant_id, change_digest),
  CHECK (json_valid(payload_json))
);

CREATE TRIGGER IF NOT EXISTS goal_graph_events_immutable_update
BEFORE UPDATE ON goal_graph_events
BEGIN
  SELECT RAISE(ABORT, 'goal graph events are immutable');
END;

CREATE TRIGGER IF NOT EXISTS goal_graph_events_immutable_delete
BEFORE DELETE ON goal_graph_events
BEGIN
  SELECT RAISE(ABORT, 'goal graph events are immutable');
END;

-- An approval is an immutable, tenant- and change-bound witness for one
-- commit attempt.  The canonical bytes bind every authority-bearing field;
-- replaying a change may read the existing witness, but cannot rewrite it.
CREATE TABLE IF NOT EXISTS goal_graph_approvals (
  approval_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  change_digest TEXT NOT NULL,
  intent_version INTEGER NOT NULL CHECK (intent_version > 0),
  approver_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  expires_at TEXT NOT NULL,
  nonce TEXT NOT NULL,
  canonical_json TEXT NOT NULL CHECK (json_valid(canonical_json)),
  decided_at TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  UNIQUE (tenant_id, change_digest, intent_version, approver_id, nonce)
);

CREATE INDEX IF NOT EXISTS idx_goal_graph_approvals_change
  ON goal_graph_approvals (tenant_id, change_digest, expires_at);

CREATE TRIGGER IF NOT EXISTS goal_graph_approvals_immutable_update
BEFORE UPDATE ON goal_graph_approvals
BEGIN
  SELECT RAISE(ABORT, 'goal graph approvals are immutable');
END;

CREATE TRIGGER IF NOT EXISTS goal_graph_approvals_immutable_delete
BEFORE DELETE ON goal_graph_approvals
BEGIN
  SELECT RAISE(ABORT, 'goal graph approvals are immutable');
END;

CREATE TABLE IF NOT EXISTS goal_graph_migrations (
  migration_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  from_graph_version INTEGER NOT NULL,
  to_graph_version INTEGER NOT NULL,
  from_node_ids_json TEXT NOT NULL,
  to_node_ids_json TEXT NOT NULL,
  classification TEXT NOT NULL CHECK (classification IN ('unchanged', 'replaced', 'retired', 'split', 'merged', 'unmapped')),
  proof_disposition TEXT NOT NULL CHECK (proof_disposition IN ('preserve', 'revalidate', 'retire', 'review_required')),
  review_required INTEGER NOT NULL CHECK (review_required IN (0, 1)),
  recorded_at TEXT NOT NULL,
  CHECK (json_valid(from_node_ids_json) AND json_valid(to_node_ids_json))
);

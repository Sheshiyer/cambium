-- Append-only branch transition evidence.  A receipt is a read-side witness
-- of a Goal Graph transition; it never promotes or mutates a graph node.

CREATE TABLE IF NOT EXISTS goal_graph_branch_transition_receipts (
  receipt_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  organ_id TEXT NOT NULL,
  organ_name TEXT NOT NULL,
  from_node_id TEXT,
  to_node_id TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  evidence_refs_json TEXT NOT NULL DEFAULT '[]',
  source_ref TEXT NOT NULL,
  source_digest TEXT NOT NULL,
  graph_version INTEGER NOT NULL CHECK (graph_version > 0),
  status TEXT NOT NULL CHECK (status IN ('verified', 'pending', 'unknown', 'blocked')),
  receipt_digest TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, receipt_id),
  UNIQUE (tenant_id, receipt_digest),
  CHECK (json_valid(evidence_refs_json)),
  CHECK (from_node_id IS NULL OR from_node_id <> to_node_id)
);

CREATE INDEX IF NOT EXISTS idx_goal_graph_branch_receipts_branch
  ON goal_graph_branch_transition_receipts (tenant_id, branch_id, graph_version, observed_at);

CREATE INDEX IF NOT EXISTS idx_goal_graph_branch_receipts_node
  ON goal_graph_branch_transition_receipts (tenant_id, to_node_id, observed_at);

CREATE TRIGGER IF NOT EXISTS goal_graph_branch_receipts_immutable_update
BEFORE UPDATE ON goal_graph_branch_transition_receipts
BEGIN
  SELECT RAISE(ABORT, 'branch transition receipts are immutable');
END;

CREATE TRIGGER IF NOT EXISTS goal_graph_branch_receipts_immutable_delete
BEFORE DELETE ON goal_graph_branch_transition_receipts
BEGIN
  SELECT RAISE(ABORT, 'branch transition receipts are immutable');
END;

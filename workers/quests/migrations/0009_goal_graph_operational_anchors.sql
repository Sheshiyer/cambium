-- Additive operational identity anchors for exact WorkObject and loadout joins.
-- Existing Goal Graph rows remain valid and explicitly unanchored.

ALTER TABLE goal_graph_nodes ADD COLUMN work_object_id TEXT;
ALTER TABLE goal_graph_nodes ADD COLUMN work_object_kind TEXT
  CHECK (work_object_kind IS NULL OR work_object_kind IN ('sapling', 'branch', 'program'));
ALTER TABLE goal_graph_nodes ADD COLUMN pinned_loadout_id TEXT;

CREATE INDEX IF NOT EXISTS idx_goal_graph_nodes_work_object
  ON goal_graph_nodes (tenant_id, work_object_id)
  WHERE work_object_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_goal_graph_nodes_loadout
  ON goal_graph_nodes (tenant_id, pinned_loadout_id)
  WHERE pinned_loadout_id IS NOT NULL;

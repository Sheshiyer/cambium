CREATE TABLE IF NOT EXISTS bridge_up (
  tenant_id TEXT NOT NULL,
  id TEXT NOT NULL,
  message_json TEXT NOT NULL,
  received_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_bridge_up_tenant_received
  ON bridge_up (tenant_id, received_at);

CREATE TABLE IF NOT EXISTS bridge_directives (
  member_id TEXT NOT NULL,
  id TEXT NOT NULL,
  directive_json TEXT NOT NULL,
  delivered INTEGER NOT NULL DEFAULT 0,
  enqueued_at TEXT NOT NULL,
  delivered_at TEXT,
  PRIMARY KEY (member_id, id)
);

CREATE INDEX IF NOT EXISTS idx_bridge_directives_member_pending
  ON bridge_directives (member_id, delivered, enqueued_at);

CREATE TABLE IF NOT EXISTS bridge_assignments (
  member_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  directive_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  correlation_id TEXT,
  payload_hash TEXT NOT NULL,
  enqueued_at TEXT NOT NULL,
  PRIMARY KEY (member_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_bridge_assignments_project_task
  ON bridge_assignments (project_id, task_id);

CREATE TABLE IF NOT EXISTS handoff_members (
  member_id TEXT PRIMARY KEY,
  member_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS handoff_token_index (
  token_hash TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS handoff_invites (
  jti TEXT PRIMARY KEY,
  invite_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_handoff_invites_used
  ON handoff_invites (used, created_at);

CREATE TABLE IF NOT EXISTS fabric_tasks (
  tenant_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  status TEXT NOT NULL,
  work_mode TEXT,
  evidence_strength TEXT NOT NULL DEFAULT 'weak_evidence',
  title TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_fabric_tasks_project_member
  ON fabric_tasks (tenant_id, project_id, member_id, updated_at);

CREATE TABLE IF NOT EXISTS fabric_task_events (
  tenant_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  type TEXT NOT NULL,
  source TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  upstream_payload_hash TEXT,
  payload_json TEXT NOT NULL,
  correlation_id TEXT,
  received_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_fabric_task_events_task_received
  ON fabric_task_events (tenant_id, task_id, received_at);

CREATE TABLE IF NOT EXISTS fabric_evidence_candidates (
  tenant_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  status TEXT NOT NULL,
  confidence TEXT NOT NULL,
  match_kind TEXT NOT NULL,
  evidence_json TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  reviewed_at TEXT,
  review_actor TEXT,
  review_reason TEXT,
  PRIMARY KEY (tenant_id, candidate_id)
);

CREATE INDEX IF NOT EXISTS idx_fabric_evidence_candidates_review
  ON fabric_evidence_candidates (tenant_id, status, created_at);

CREATE TABLE IF NOT EXISTS fabric_evidence_reviews (
  tenant_id TEXT NOT NULL,
  review_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT,
  reviewed_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, review_id)
);

CREATE INDEX IF NOT EXISTS idx_fabric_evidence_reviews_candidate
  ON fabric_evidence_reviews (tenant_id, candidate_id, reviewed_at);

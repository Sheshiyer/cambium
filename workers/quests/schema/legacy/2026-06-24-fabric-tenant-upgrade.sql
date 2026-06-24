-- Manual legacy-only upgrade for pre-tenant Fabric D1 tables.
--
-- Do not place this file in workers/quests/migrations or run it as part of the
-- normal Wrangler migration stream. Apply it only to old single-tenant D1
-- databases after verifying the Fabric tables exist and lack tenant_id columns.
-- It preserves legacy rows under the cambium tenant while rebuilding the Fabric
-- tables to the tenant-aware primary keys used by schema/bridge.sql.

DROP INDEX IF EXISTS idx_fabric_tasks_project_member;
ALTER TABLE fabric_tasks RENAME TO fabric_tasks_legacy_0001;
CREATE TABLE fabric_tasks (
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
INSERT OR IGNORE INTO fabric_tasks (
  tenant_id, task_id, project_id, member_id, status, work_mode, evidence_strength, title, payload_json, updated_at
)
SELECT
  'cambium', task_id, project_id, member_id, status, work_mode, evidence_strength, title, payload_json, updated_at
FROM fabric_tasks_legacy_0001;
DROP TABLE fabric_tasks_legacy_0001;
CREATE INDEX IF NOT EXISTS idx_fabric_tasks_project_member
  ON fabric_tasks (tenant_id, project_id, member_id, updated_at);

DROP INDEX IF EXISTS idx_fabric_task_events_task_received;
ALTER TABLE fabric_task_events RENAME TO fabric_task_events_legacy_0001;
CREATE TABLE fabric_task_events (
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
INSERT OR IGNORE INTO fabric_task_events (
  tenant_id, event_id, task_id, project_id, member_id, type, source, payload_hash,
  upstream_payload_hash, payload_json, correlation_id, received_at
)
SELECT
  'cambium', event_id, task_id, project_id, member_id, type, source, payload_hash,
  NULL, payload_json, correlation_id, received_at
FROM fabric_task_events_legacy_0001;
DROP TABLE fabric_task_events_legacy_0001;
CREATE INDEX IF NOT EXISTS idx_fabric_task_events_task_received
  ON fabric_task_events (tenant_id, task_id, received_at);

DROP INDEX IF EXISTS idx_fabric_evidence_candidates_review;
ALTER TABLE fabric_evidence_candidates RENAME TO fabric_evidence_candidates_legacy_0001;
CREATE TABLE fabric_evidence_candidates (
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
INSERT OR IGNORE INTO fabric_evidence_candidates (
  tenant_id, candidate_id, task_id, project_id, member_id, status, confidence, match_kind,
  evidence_json, reason, created_at, reviewed_at, review_actor, review_reason
)
SELECT
  'cambium', candidate_id, task_id, project_id, member_id, status, confidence, match_kind,
  evidence_json, reason, created_at, reviewed_at, review_actor, review_reason
FROM fabric_evidence_candidates_legacy_0001;
DROP TABLE fabric_evidence_candidates_legacy_0001;
CREATE INDEX IF NOT EXISTS idx_fabric_evidence_candidates_review
  ON fabric_evidence_candidates (tenant_id, status, created_at);

DROP INDEX IF EXISTS idx_fabric_evidence_reviews_candidate;
ALTER TABLE fabric_evidence_reviews RENAME TO fabric_evidence_reviews_legacy_0001;
CREATE TABLE fabric_evidence_reviews (
  tenant_id TEXT NOT NULL,
  review_id TEXT NOT NULL,
  candidate_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  actor TEXT NOT NULL,
  reason TEXT,
  reviewed_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, review_id)
);
INSERT OR IGNORE INTO fabric_evidence_reviews (
  tenant_id, review_id, candidate_id, outcome, actor, reason, reviewed_at
)
SELECT
  'cambium', review_id, candidate_id, outcome, actor, reason, reviewed_at
FROM fabric_evidence_reviews_legacy_0001;
DROP TABLE fabric_evidence_reviews_legacy_0001;
CREATE INDEX IF NOT EXISTS idx_fabric_evidence_reviews_candidate
  ON fabric_evidence_reviews (tenant_id, candidate_id, reviewed_at);

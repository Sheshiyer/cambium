CREATE TABLE IF NOT EXISTS bridge_role_task_claims (
  event_id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  binding_version TEXT NOT NULL,
  intent_hash TEXT NOT NULL,
  claimed_at TEXT NOT NULL
);

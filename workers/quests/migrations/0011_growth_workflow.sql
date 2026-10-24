-- Internal organization drafts only. Identity is derived from an active bridge member.
CREATE TABLE IF NOT EXISTS bridge_growth_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  intent_digest TEXT NOT NULL,
  record_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','retrying','failed','draft_ready')),
  result_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, member_id, request_id)
);
CREATE INDEX IF NOT EXISTS idx_growth_member ON bridge_growth_requests (tenant_id,member_id,created_at);

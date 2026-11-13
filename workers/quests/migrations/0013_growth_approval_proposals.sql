-- Pending founder review records. Decisions retain their existing receipt table.
CREATE TABLE IF NOT EXISTS growth_approval_proposals (
  tenant_id TEXT NOT NULL,
  change_digest TEXT NOT NULL,
  calendar_row_id TEXT NOT NULL,
  record_json TEXT NOT NULL,
  PRIMARY KEY (tenant_id, change_digest),
  UNIQUE (tenant_id, calendar_row_id)
);

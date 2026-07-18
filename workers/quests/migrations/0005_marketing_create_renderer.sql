-- Fixed-tenant founder-article renderer. Prepared facts and normalized review
-- artifacts are durable; provider credentials and raw responses are never stored.

CREATE TABLE IF NOT EXISTS marketing_render_runs (
  request_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL DEFAULT 'thoughtseed' CHECK (tenant_id = 'thoughtseed'),
  adapter_id TEXT NOT NULL DEFAULT 'founder-article-nvidia@1.0.0' CHECK (adapter_id = 'founder-article-nvidia@1.0.0'),
  adapter_catalog_digest TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  budget_reservation_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  input_digest TEXT NOT NULL,
  action_digest TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  prepared_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('prepared', 'claimed', 'invoking', 'succeeded', 'failed', 'indeterminate')),
  approval_decision_id TEXT,
  claim_id TEXT,
  fencing_token INTEGER NOT NULL DEFAULT 0 CHECK (fencing_token >= 0),
  attempt INTEGER NOT NULL DEFAULT 1 CHECK (attempt = 1),
  claimed_at TEXT,
  lease_expires_at TEXT,
  invoked_at TEXT,
  artifact_json TEXT,
  receipt_json TEXT,
  artifact_digest TEXT,
  provider_usage_tokens INTEGER CHECK (provider_usage_tokens IS NULL OR provider_usage_tokens >= 0),
  error_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  terminal_at TEXT,
  UNIQUE (tenant_id, idempotency_key),
  CHECK (status = 'prepared' OR (approval_decision_id IS NOT NULL AND claim_id IS NOT NULL AND fencing_token >= 1)),
  CHECK (status NOT IN ('invoking', 'succeeded', 'failed', 'indeterminate') OR invoked_at IS NOT NULL),
  CHECK (status <> 'succeeded' OR (artifact_json IS NOT NULL AND receipt_json IS NOT NULL AND artifact_digest IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_marketing_render_runs_status
  ON marketing_render_runs (tenant_id, status, updated_at);

CREATE TABLE IF NOT EXISTS marketing_render_approvals (
  approval_decision_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL DEFAULT 'thoughtseed' CHECK (tenant_id = 'thoughtseed'),
  action_digest TEXT NOT NULL,
  approver_id TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('approved', 'rejected')),
  decided_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  approval_json TEXT NOT NULL,
  UNIQUE (request_id, action_digest, approver_id)
);

CREATE INDEX IF NOT EXISTS idx_marketing_render_approvals_request
  ON marketing_render_approvals (tenant_id, request_id, decided_at);


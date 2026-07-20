-- One bounded business slice: synthetic service-agreement draft tasks and
-- immutable artifact receipts. D1 owns task/lease/outcome metadata; R2 owns bytes.

CREATE TABLE IF NOT EXISTS bridge_business_tasks (
  business_task_id TEXT PRIMARY KEY,
  gsd_task_id TEXT NOT NULL UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  intent_digest TEXT NOT NULL,
  directive_id TEXT NOT NULL UNIQUE,
  directive_schema TEXT NOT NULL,
  member_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  workflow_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN (
    'queued', 'leased', 'rendering', 'artifact_stored', 'retrying',
    'awaiting_human_approval', 'failed'
  )),
  request_json TEXT NOT NULL,
  approval_scope TEXT NOT NULL,
  approval_observation_id TEXT NOT NULL,
  approval_observed_at TEXT NOT NULL,
  synthetic INTEGER NOT NULL DEFAULT 1 CHECK (synthetic = 1),
  external_action TEXT NOT NULL DEFAULT 'none' CHECK (external_action = 'none'),
  execution_id TEXT,
  artifact_id TEXT UNIQUE,
  artifact_digest TEXT,
  artifact_byte_length INTEGER CHECK (artifact_byte_length IS NULL OR artifact_byte_length > 0),
  artifact_content_type TEXT,
  artifact_r2_key TEXT UNIQUE,
  content_policy_id TEXT,
  content_policy_digest TEXT,
  renderer_policy_id TEXT,
  renderer_policy_digest TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  terminal_at TEXT,
  CHECK (
    status NOT IN ('artifact_stored', 'awaiting_human_approval')
    OR (
      execution_id IS NOT NULL
      AND artifact_id IS NOT NULL
      AND artifact_digest IS NOT NULL
      AND artifact_byte_length IS NOT NULL
      AND artifact_content_type IS NOT NULL
      AND artifact_r2_key IS NOT NULL
      AND content_policy_id IS NOT NULL
      AND content_policy_digest IS NOT NULL
      AND renderer_policy_id IS NOT NULL
      AND renderer_policy_digest IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_bridge_business_tasks_member_status
  ON bridge_business_tasks (member_id, status, updated_at);

CREATE INDEX IF NOT EXISTS idx_bridge_business_tasks_execution
  ON bridge_business_tasks (execution_id);

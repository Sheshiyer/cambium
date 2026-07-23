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

CREATE TABLE IF NOT EXISTS bridge_executions (
  member_id TEXT NOT NULL,
  directive_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  input_digest TEXT NOT NULL,
  execution_id TEXT NOT NULL UNIQUE,
  claim_id TEXT NOT NULL,
  fencing_token TEXT NOT NULL,
  lease_expires_at TEXT NOT NULL,
  runner_id TEXT NOT NULL,
  host_identity TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 1 CHECK (attempt > 0),
  outcome_status TEXT CHECK (outcome_status IN ('executed', 'failed', 'retryable')),
  terminal INTEGER NOT NULL DEFAULT 0 CHECK (terminal IN (0, 1)),
  attestation_json TEXT,
  attestation_id TEXT,
  attestation_digest TEXT,
  claimed_at TEXT NOT NULL,
  outcome_recorded_at TEXT,
  acknowledged_at TEXT,
  PRIMARY KEY (member_id, directive_id),
  CHECK (
    terminal = 0
    OR (
      outcome_status IN ('executed', 'failed')
      AND attestation_json IS NOT NULL
      AND attestation_id IS NOT NULL
      AND attestation_digest IS NOT NULL
      AND outcome_recorded_at IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_bridge_executions_lease
  ON bridge_executions (terminal, lease_expires_at);

CREATE INDEX IF NOT EXISTS idx_bridge_executions_terminal_ack
  ON bridge_executions (member_id, directive_id, terminal, acknowledged_at);

CREATE TABLE IF NOT EXISTS bridge_execution_identities (
  execution_id TEXT PRIMARY KEY,
  member_id TEXT NOT NULL,
  directive_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  input_digest TEXT NOT NULL,
  runner_id TEXT NOT NULL,
  host_identity TEXT NOT NULL,
  first_claimed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS bridge_execution_claims (
  execution_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  directive_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  input_digest TEXT NOT NULL,
  claim_id TEXT NOT NULL,
  fencing_token TEXT NOT NULL,
  lease_expires_at TEXT NOT NULL,
  runner_id TEXT NOT NULL,
  host_identity TEXT NOT NULL,
  attempt INTEGER NOT NULL CHECK (attempt > 0),
  claimed_at TEXT NOT NULL,
  PRIMARY KEY (execution_id, attempt)
);

CREATE INDEX IF NOT EXISTS idx_bridge_execution_claims_directive
  ON bridge_execution_claims (member_id, directive_id, attempt);

-- D1's remote SQL API rejects SELECT CASE ... RAISE() inside trigger bodies.
-- Keep the identity check as a dedicated BEFORE guard using the supported
-- WHEN ... SELECT RAISE() form, then record history in the AFTER trigger.
CREATE TRIGGER IF NOT EXISTS bridge_execution_identity_guard_insert
BEFORE INSERT ON bridge_executions
WHEN EXISTS (
    SELECT 1 FROM bridge_execution_identities
    WHERE execution_id = NEW.execution_id
      AND (
        member_id <> NEW.member_id
        OR directive_id <> NEW.directive_id
        OR idempotency_key <> NEW.idempotency_key
        OR input_digest <> NEW.input_digest
        OR runner_id <> NEW.runner_id
        OR host_identity <> NEW.host_identity
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'execution identity conflict');
END;

CREATE TRIGGER IF NOT EXISTS bridge_execution_claim_history_insert
AFTER INSERT ON bridge_executions
BEGIN
  INSERT INTO bridge_execution_identities (
    execution_id, member_id, directive_id, idempotency_key, input_digest, runner_id,
    host_identity, first_claimed_at
  ) VALUES (
    NEW.execution_id, NEW.member_id, NEW.directive_id, NEW.idempotency_key,
    NEW.input_digest, NEW.runner_id, NEW.host_identity, NEW.claimed_at
  ) ON CONFLICT(execution_id) DO NOTHING;
  INSERT INTO bridge_execution_claims (
    execution_id, member_id, directive_id, idempotency_key, input_digest, claim_id,
    fencing_token, lease_expires_at, runner_id, host_identity, attempt, claimed_at
  ) VALUES (
    NEW.execution_id, NEW.member_id, NEW.directive_id, NEW.idempotency_key,
    NEW.input_digest, NEW.claim_id, NEW.fencing_token, NEW.lease_expires_at, NEW.runner_id,
    NEW.host_identity, NEW.attempt, NEW.claimed_at
  );
END;

CREATE TRIGGER IF NOT EXISTS bridge_execution_identity_guard_takeover
BEFORE UPDATE OF attempt ON bridge_executions
WHEN NEW.attempt <> OLD.attempt
  AND EXISTS (
    SELECT 1 FROM bridge_execution_identities
    WHERE execution_id = NEW.execution_id
      AND (
        member_id <> NEW.member_id
        OR directive_id <> NEW.directive_id
        OR idempotency_key <> NEW.idempotency_key
        OR input_digest <> NEW.input_digest
        OR runner_id <> NEW.runner_id
        OR host_identity <> NEW.host_identity
      )
  )
BEGIN
  SELECT RAISE(ABORT, 'execution identity conflict');
END;

CREATE TRIGGER IF NOT EXISTS bridge_execution_claim_history_takeover
AFTER UPDATE OF attempt ON bridge_executions
WHEN NEW.attempt <> OLD.attempt
BEGIN
  INSERT INTO bridge_execution_identities (
    execution_id, member_id, directive_id, idempotency_key, input_digest, runner_id,
    host_identity, first_claimed_at
  ) VALUES (
    NEW.execution_id, NEW.member_id, NEW.directive_id, NEW.idempotency_key,
    NEW.input_digest, NEW.runner_id, NEW.host_identity, NEW.claimed_at
  ) ON CONFLICT(execution_id) DO NOTHING;
  INSERT INTO bridge_execution_claims (
    execution_id, member_id, directive_id, idempotency_key, input_digest, claim_id,
    fencing_token, lease_expires_at, runner_id, host_identity, attempt, claimed_at
  ) VALUES (
    NEW.execution_id, NEW.member_id, NEW.directive_id, NEW.idempotency_key,
    NEW.input_digest, NEW.claim_id, NEW.fencing_token, NEW.lease_expires_at, NEW.runner_id,
    NEW.host_identity, NEW.attempt, NEW.claimed_at
  );
END;

CREATE TABLE IF NOT EXISTS bridge_execution_events (
  execution_id TEXT NOT NULL,
  attestation_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  directive_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('executed', 'failed', 'retryable')),
  attestation_digest TEXT NOT NULL,
  event_json TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  PRIMARY KEY (execution_id, attestation_id)
);

CREATE INDEX IF NOT EXISTS idx_bridge_execution_events_directive
  ON bridge_execution_events (member_id, directive_id, recorded_at);

CREATE TRIGGER IF NOT EXISTS bridge_execution_ack_timestamp
AFTER UPDATE OF delivered ON bridge_directives
WHEN NEW.delivered = 1 AND OLD.delivered = 0
BEGIN
  UPDATE bridge_executions
  SET acknowledged_at = NEW.delivered_at
  WHERE member_id = NEW.member_id
    AND directive_id = NEW.id
    AND terminal = 1;
END;

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

CREATE TABLE IF NOT EXISTS bridge_role_task_claims (
  event_id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  project_id TEXT NOT NULL,
  binding_version TEXT NOT NULL,
  intent_hash TEXT NOT NULL,
  claimed_at TEXT NOT NULL
);

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

-- Durable lead identity, observation, spend, task, and derived-learning spine.
-- Provider bodies and cortex-bound raw identity never enter these records.


CREATE TABLE IF NOT EXISTS lead_records (
  lead_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  normalized_email TEXT,
  created_at TEXT NOT NULL,
  CHECK (normalized_email IS NULL OR (
    length(normalized_email) BETWEEN 3 AND 320
    AND normalized_email = lower(trim(normalized_email))
  )),
  UNIQUE (tenant_id, normalized_email)
);

CREATE INDEX IF NOT EXISTS idx_lead_records_tenant_created
  ON lead_records (tenant_id, created_at);

CREATE TABLE IF NOT EXISTS lead_source_aliases (
  alias_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  first_observed_at TEXT NOT NULL,
  UNIQUE (tenant_id, provider_id, source_id)
);

CREATE INDEX IF NOT EXISTS idx_lead_source_aliases_lead
  ON lead_source_aliases (tenant_id, lead_id, first_observed_at);

CREATE TABLE IF NOT EXISTS lead_observation_receipts (
  observation_receipt_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  lead_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET' CHECK (method = 'GET'),
  idempotency_key TEXT NOT NULL,
  observation_digest TEXT NOT NULL,
  observed_at TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  UNIQUE (tenant_id, idempotency_key),
  UNIQUE (tenant_id, provider_id, source_id, observation_digest)
);

CREATE INDEX IF NOT EXISTS idx_lead_observation_receipts_lead
  ON lead_observation_receipts (tenant_id, lead_id, observed_at);

CREATE TRIGGER IF NOT EXISTS lead_observation_receipts_immutable_update
BEFORE UPDATE ON lead_observation_receipts
BEGIN
  SELECT RAISE(ABORT, 'lead observation receipts are immutable');
END;

CREATE TRIGGER IF NOT EXISTS lead_observation_receipts_immutable_delete
BEFORE DELETE ON lead_observation_receipts
BEGIN
  SELECT RAISE(ABORT, 'lead observation receipts are immutable');
END;

CREATE TABLE IF NOT EXISTS lead_loop_tasks (
  task_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  input_digest TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'stopped')),
  claim_id TEXT,
  fencing_token INTEGER NOT NULL DEFAULT 0 CHECK (fencing_token >= 0),
  lease_expires_at TEXT,
  receipt_json TEXT,
  error_code TEXT,
  stop_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  terminal_at TEXT,
  UNIQUE (tenant_id, idempotency_key),
  CHECK (
    status <> 'running'
    OR (claim_id IS NOT NULL AND fencing_token >= 1 AND lease_expires_at IS NOT NULL)
  ),
  CHECK (status <> 'completed' OR (receipt_json IS NOT NULL AND terminal_at IS NOT NULL)),
  CHECK (status <> 'failed' OR (error_code IS NOT NULL AND terminal_at IS NOT NULL)),
  CHECK (status <> 'stopped' OR (stop_reason IS NOT NULL AND terminal_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_lead_loop_tasks_status_lease
  ON lead_loop_tasks (tenant_id, status, lease_expires_at);

CREATE TRIGGER IF NOT EXISTS lead_loop_tasks_terminal_immutable
BEFORE UPDATE ON lead_loop_tasks
WHEN OLD.status IN ('completed', 'failed', 'stopped')
BEGIN
  SELECT RAISE(ABORT, 'terminal lead tasks are immutable');
END;

CREATE TRIGGER IF NOT EXISTS lead_loop_tasks_completed_receipt_guard
BEFORE UPDATE OF status ON lead_loop_tasks
WHEN NEW.status = 'completed' AND (
  NOT json_valid(NEW.receipt_json)
  OR json_extract(NEW.receipt_json, '$.schemaVersion') IS NOT 'lead_operator_receipt@1.0.0'
  OR json_extract(NEW.receipt_json, '$.taskId') IS NOT NEW.task_id
  OR json_extract(NEW.receipt_json, '$.state') IS NOT 'completed'
  OR json_type(NEW.receipt_json, '$.leadId') IS NOT 'text'
  OR json_type(NEW.receipt_json, '$.observationCount') IS NOT 'integer'
  OR json_extract(NEW.receipt_json, '$.observationCount') < 0
  OR json_type(NEW.receipt_json, '$.stagesCompleted') IS NOT 'integer'
  OR json_extract(NEW.receipt_json, '$.stagesCompleted') < 0
  OR json_type(NEW.receipt_json, '$.spendUnits') IS NOT 'integer'
  OR json_extract(NEW.receipt_json, '$.spendUnits') < 0
  OR json_extract(NEW.receipt_json, '$.updatedAt') IS NOT NEW.terminal_at
)
BEGIN
  SELECT RAISE(ABORT, 'completed lead task receipt is invalid');
END;

CREATE TABLE IF NOT EXISTS lead_spend_reservations (
  reservation_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'usd_micros' CHECK (unit = 'usd_micros'),
  reserved_units INTEGER NOT NULL CHECK (reserved_units >= 0),
  settled_units INTEGER CHECK (settled_units IS NULL OR (
    settled_units >= 0 AND settled_units <= reserved_units
  )),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'settled')),
  created_at TEXT NOT NULL,
  settled_at TEXT,
  UNIQUE (tenant_id, idempotency_key),
  CHECK (
    (status = 'reserved' AND settled_units IS NULL AND settled_at IS NULL)
    OR (status = 'settled' AND settled_units IS NOT NULL AND settled_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_lead_spend_reservations_task
  ON lead_spend_reservations (tenant_id, task_id, status);

CREATE TRIGGER IF NOT EXISTS lead_spend_reservations_identity_immutable
BEFORE UPDATE ON lead_spend_reservations
WHEN NEW.reservation_id <> OLD.reservation_id
  OR NEW.tenant_id <> OLD.tenant_id
  OR NEW.task_id <> OLD.task_id
  OR NEW.provider_id <> OLD.provider_id
  OR NEW.idempotency_key <> OLD.idempotency_key
  OR NEW.unit <> OLD.unit
  OR NEW.reserved_units <> OLD.reserved_units
  OR NEW.created_at <> OLD.created_at
BEGIN
  SELECT RAISE(ABORT, 'lead spend reservation identity is immutable');
END;

CREATE TRIGGER IF NOT EXISTS lead_spend_reservations_settled_immutable
BEFORE UPDATE ON lead_spend_reservations
WHEN OLD.status = 'settled'
BEGIN
  SELECT RAISE(ABORT, 'settled lead spend reservations are immutable');
END;

CREATE TRIGGER IF NOT EXISTS lead_spend_reservations_settlement_guard
BEFORE UPDATE OF status ON lead_spend_reservations
WHEN NEW.status = 'settled'
  AND NOT EXISTS (
    SELECT 1 FROM lead_provider_usage
    WHERE reservation_id = NEW.reservation_id
      AND tenant_id = NEW.tenant_id
      AND task_id = NEW.task_id
      AND provider_id = NEW.provider_id
      AND unit = NEW.unit
      AND used_units = NEW.settled_units
      AND recorded_at = NEW.settled_at
  )
BEGIN
  SELECT RAISE(ABORT, 'lead spend reservation settlement requires usage receipt');
END;

CREATE TABLE IF NOT EXISTS lead_provider_usage (
  usage_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  reservation_id TEXT NOT NULL UNIQUE,
  provider_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'usd_micros' CHECK (unit = 'usd_micros'),
  used_units INTEGER NOT NULL CHECK (used_units >= 0),
  receipt_digest TEXT NOT NULL,
  recorded_at TEXT NOT NULL,
  UNIQUE (tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_lead_provider_usage_task
  ON lead_provider_usage (tenant_id, task_id, recorded_at);

CREATE TRIGGER IF NOT EXISTS lead_provider_usage_reservation_guard
BEFORE INSERT ON lead_provider_usage
WHEN NOT EXISTS (
    SELECT 1 FROM lead_spend_reservations
    WHERE reservation_id = NEW.reservation_id
      AND tenant_id = NEW.tenant_id
      AND task_id = NEW.task_id
      AND provider_id = NEW.provider_id
      AND unit = NEW.unit
      AND status = 'reserved'
      AND NEW.used_units <= reserved_units
  )
BEGIN
  SELECT RAISE(ABORT, 'provider usage exceeds or lacks reservation');
END;

CREATE TRIGGER IF NOT EXISTS lead_provider_usage_settle_reservation
AFTER INSERT ON lead_provider_usage
BEGIN
  UPDATE lead_spend_reservations
  SET status = 'settled', settled_units = NEW.used_units, settled_at = NEW.recorded_at
  WHERE reservation_id = NEW.reservation_id
    AND tenant_id = NEW.tenant_id
    AND status = 'reserved';
END;

CREATE TRIGGER IF NOT EXISTS lead_provider_usage_immutable_update
BEFORE UPDATE ON lead_provider_usage
BEGIN
  SELECT RAISE(ABORT, 'lead provider usage is immutable');
END;

CREATE TRIGGER IF NOT EXISTS lead_provider_usage_immutable_delete
BEFORE DELETE ON lead_provider_usage
BEGIN
  SELECT RAISE(ABORT, 'lead provider usage is immutable');
END;

CREATE TABLE IF NOT EXISTS lead_cortex_foldbacks (
  foldback_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  task_id TEXT NOT NULL UNIQUE,
  transformation_version TEXT NOT NULL,
  leads_captured INTEGER NOT NULL CHECK (leads_captured >= 0),
  observations_recorded INTEGER NOT NULL CHECK (observations_recorded >= 0),
  stages_completed INTEGER NOT NULL CHECK (stages_completed >= 0),
  spend_units INTEGER NOT NULL CHECK (spend_units >= 0),
  completed_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lead_cortex_foldbacks_tenant_completed
  ON lead_cortex_foldbacks (tenant_id, completed_at);

CREATE TRIGGER IF NOT EXISTS lead_cortex_foldbacks_completed_task_guard
BEFORE INSERT ON lead_cortex_foldbacks
WHEN NOT EXISTS (
  SELECT 1 FROM lead_loop_tasks
  WHERE task_id = NEW.task_id
    AND tenant_id = NEW.tenant_id
    AND status = 'completed'
    AND json_valid(receipt_json)
    AND NEW.transformation_version = 'lead-runtime-derived-v1'
    AND NEW.leads_captured = 1
    AND NEW.observations_recorded = json_extract(receipt_json, '$.observationCount')
    AND NEW.stages_completed = json_extract(receipt_json, '$.stagesCompleted')
    AND NEW.spend_units = json_extract(receipt_json, '$.spendUnits')
    AND NEW.completed_at = json_extract(receipt_json, '$.updatedAt')
)
BEGIN
  SELECT RAISE(ABORT, 'lead cortex foldback must derive from completed task receipt');
END;

CREATE TRIGGER IF NOT EXISTS lead_cortex_foldbacks_immutable_update
BEFORE UPDATE ON lead_cortex_foldbacks
BEGIN
  SELECT RAISE(ABORT, 'lead cortex foldbacks are immutable');
END;

CREATE TRIGGER IF NOT EXISTS lead_cortex_foldbacks_immutable_delete
BEFORE DELETE ON lead_cortex_foldbacks
BEGIN
  SELECT RAISE(ABORT, 'lead cortex foldbacks are immutable');
END;

-- Append-only branch transition evidence. The D1 migration is mirrored here
-- because this file is the canonical local schema used by integration tests.
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

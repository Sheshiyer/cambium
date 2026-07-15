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

-- Durable Hermes execution claims and redacted terminal outcomes.
-- One row owns each member/directive pair. The UPSERT in d1BridgeExecutionStore
-- uses this primary key as its atomic lease compare-and-swap boundary.

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

-- Stable identity prevents one execution id from moving between directives or
-- runner identities, while the attempt table preserves every fencing lease.
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

-- Audit rows contain only the status plus canonical digest attestation fields.
-- Raw executor input, credentials, authorization headers, and errors are never
-- accepted by the handler or written here.
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

-- ACK uses one guarded bridge_directives update. This trigger records its
-- timestamp in the execution row inside the same SQLite transaction.
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

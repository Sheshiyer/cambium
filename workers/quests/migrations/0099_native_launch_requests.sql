-- Native-founder launch owner contract (cambium.native-launch.v1).
-- Additive only. D1 is the sole request authority; there is no KV shadow.
--
-- native_launch_admissions holds server-owned admission pins. This migration
-- installs no writer: rows come only from a separate owner-reviewed admission
-- path. Without rows every capability reads `unavailable`.
--
-- native_launch_requests holds one durable reservation per scoped requestId.
-- The adapter reserves with ONE conditional INSERT ... SELECT that joins the
-- current active, unexpired admission and the current tenant Goal Graph head
-- (compare-and-swap on current admission). The unique indexes below make
-- concurrent reservations collision-safe: one admission backs at most one
-- request, and requestId / attemptId / idempotencyNonce cannot be reused within
-- a principal scope. Requires goal_graph_heads from 0007_goal_graph.sql.

CREATE TABLE IF NOT EXISTS native_launch_admissions (
  tenant_id TEXT NOT NULL,
  admission_ref TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  work_id TEXT NOT NULL,
  graph_version INTEGER NOT NULL CHECK (graph_version >= 1),
  loadout_id TEXT NOT NULL,
  input_digest TEXT NOT NULL CHECK (input_digest GLOB 'sha256:*' AND length(input_digest) = 71),
  execution_plant TEXT NOT NULL CHECK (execution_plant IN ('temperance-hands', 'hermes-remote')),
  supported_action TEXT NOT NULL CHECK (supported_action IN ('launch')),
  expires_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'revoked')),
  recorded_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, admission_ref)
);

-- Pins are immutable once recorded; the only permitted change is revocation.
CREATE TRIGGER IF NOT EXISTS native_launch_admissions_pins_immutable
BEFORE UPDATE OF tenant_id, admission_ref, principal_id, work_id, graph_version, loadout_id,
  input_digest, execution_plant, supported_action, expires_at, recorded_at
ON native_launch_admissions
BEGIN
  SELECT RAISE(ABORT, 'native launch admission pins are immutable');
END;

CREATE TRIGGER IF NOT EXISTS native_launch_admissions_revoke_only
BEFORE UPDATE OF status ON native_launch_admissions
WHEN NOT (OLD.status = 'active' AND NEW.status = 'revoked')
BEGIN
  SELECT RAISE(ABORT, 'native launch admission may only be revoked');
END;

CREATE TABLE IF NOT EXISTS native_launch_requests (
  request_key TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  principal_id TEXT NOT NULL,
  request_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  idempotency_nonce TEXT NOT NULL,
  request_digest TEXT NOT NULL,
  work_id TEXT NOT NULL,
  admission_ref TEXT NOT NULL,
  graph_version INTEGER NOT NULL,
  loadout_id TEXT NOT NULL,
  input_digest TEXT NOT NULL,
  execution_plant TEXT NOT NULL CHECK (execution_plant IN ('temperance-hands', 'hermes-remote')),
  supported_action TEXT NOT NULL CHECK (supported_action IN ('launch')),
  expires_at TEXT NOT NULL,
  dispatch TEXT NOT NULL CHECK (dispatch IN ('reserved', 'owner_answered', 'owner_unknown')),
  execution TEXT NOT NULL CHECK (execution IN
    ('unknown', 'accepted', 'queued', 'running', 'succeeded', 'failed', 'refused', 'busy')),
  owner_ref TEXT,
  reserved_at TEXT NOT NULL,
  observed_at TEXT,
  FOREIGN KEY (tenant_id, admission_ref) REFERENCES native_launch_admissions (tenant_id, admission_ref)
);

CREATE UNIQUE INDEX IF NOT EXISTS native_launch_requests_request_unique
ON native_launch_requests (tenant_id, principal_id, request_id);
CREATE UNIQUE INDEX IF NOT EXISTS native_launch_requests_attempt_unique
ON native_launch_requests (tenant_id, principal_id, attempt_id);
CREATE UNIQUE INDEX IF NOT EXISTS native_launch_requests_nonce_unique
ON native_launch_requests (tenant_id, principal_id, idempotency_nonce);
CREATE UNIQUE INDEX IF NOT EXISTS native_launch_requests_admission_unique
ON native_launch_requests (tenant_id, admission_ref);

-- Identity, pins and reservation time never change after reservation.
CREATE TRIGGER IF NOT EXISTS native_launch_requests_identity_immutable
BEFORE UPDATE OF request_key, tenant_id, principal_id, request_id, attempt_id, idempotency_nonce,
  request_digest, work_id, admission_ref, graph_version, loadout_id, input_digest,
  execution_plant, supported_action, expires_at, reserved_at
ON native_launch_requests
BEGIN
  SELECT RAISE(ABORT, 'native launch request identity is immutable');
END;

-- Terminal execution observations are sticky.
CREATE TRIGGER IF NOT EXISTS native_launch_requests_terminal_sticky
BEFORE UPDATE OF execution ON native_launch_requests
WHEN OLD.execution IN ('succeeded', 'failed', 'refused', 'busy') AND NEW.execution <> OLD.execution
BEGIN
  SELECT RAISE(ABORT, 'native launch terminal execution is final');
END;

-- Durable rows are recovery evidence; retention needs a separate reviewed migration.
CREATE TRIGGER IF NOT EXISTS native_launch_requests_no_delete
BEFORE DELETE ON native_launch_requests
BEGIN
  SELECT RAISE(ABORT, 'native launch requests are retained');
END;

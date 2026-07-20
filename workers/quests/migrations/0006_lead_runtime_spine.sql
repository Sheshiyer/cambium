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

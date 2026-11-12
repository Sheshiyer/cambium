-- Owner-derived pins for a founder-approved direction execution child.
-- No admission is seeded. One conditional owner insert and this trigger create
-- the evidence binding and existing native capability atomically.
CREATE TABLE native_direction_admissions (
  tenant_id TEXT NOT NULL, admission_ref TEXT NOT NULL, principal_id TEXT NOT NULL,
  work_id TEXT NOT NULL, graph_version INTEGER NOT NULL, loadout_id TEXT NOT NULL,
  input_digest TEXT NOT NULL, expires_at TEXT NOT NULL, recorded_at TEXT NOT NULL,
  proposal_digest TEXT NOT NULL, execution_node_id TEXT NOT NULL,
  direction_id TEXT NOT NULL, direction_revision INTEGER NOT NULL,
  policy_digest TEXT NOT NULL, review_digest TEXT NOT NULL, review_document TEXT NOT NULL,
  PRIMARY KEY (tenant_id, admission_ref),
  CHECK (json_valid(review_document)), CHECK (direction_revision > 0), CHECK (graph_version > 0)
);
CREATE TRIGGER native_direction_admission_apply AFTER INSERT ON native_direction_admissions BEGIN
  INSERT INTO native_launch_admissions (
    tenant_id, admission_ref, principal_id, work_id, graph_version, loadout_id,
    input_digest, execution_plant, supported_action, expires_at, status, recorded_at
  ) VALUES (NEW.tenant_id, NEW.admission_ref, NEW.principal_id, NEW.work_id,
    NEW.graph_version, NEW.loadout_id, NEW.input_digest, 'hermes-remote', 'launch',
    NEW.expires_at, 'active', NEW.recorded_at);
END;
CREATE TRIGGER native_direction_admissions_immutable BEFORE UPDATE ON native_direction_admissions BEGIN
  SELECT RAISE(ABORT, 'direction admission pins are immutable');
END;
CREATE TRIGGER native_direction_admissions_retained BEFORE DELETE ON native_direction_admissions BEGIN
  SELECT RAISE(ABORT, 'direction admission pins are retained');
END;

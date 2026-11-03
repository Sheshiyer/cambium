CREATE TABLE shared_signals (
  tenant_id TEXT NOT NULL, principal_id TEXT NOT NULL, signal_id TEXT NOT NULL,
  revision INTEGER NOT NULL, created_at TEXT NOT NULL, document TEXT NOT NULL,
  PRIMARY KEY (tenant_id, principal_id, signal_id)
);
CREATE INDEX shared_signals_page ON shared_signals (tenant_id, principal_id, created_at DESC, signal_id DESC);
CREATE TABLE shared_signal_operations (
  tenant_id TEXT NOT NULL, principal_id TEXT NOT NULL, operation_id TEXT NOT NULL,
  request TEXT NOT NULL, signal_id TEXT NOT NULL, expected_revision INTEGER NOT NULL,
  result TEXT NOT NULL,
  PRIMARY KEY (tenant_id, principal_id, operation_id)
);
CREATE TRIGGER shared_signal_operation_apply AFTER INSERT ON shared_signal_operations BEGIN
  INSERT INTO shared_signals (tenant_id, principal_id, signal_id, revision, created_at, document)
    SELECT NEW.tenant_id, NEW.principal_id, NEW.signal_id, 1, json_extract(NEW.result, '$.createdAt'), NEW.result
    WHERE NEW.expected_revision = 0;
  UPDATE shared_signals SET revision = revision + 1, document = NEW.result
    WHERE NEW.expected_revision > 0 AND tenant_id = NEW.tenant_id AND principal_id = NEW.principal_id
      AND signal_id = NEW.signal_id AND revision = NEW.expected_revision;
  SELECT CASE WHEN NEW.expected_revision > 0 AND changes() != 1 THEN RAISE(ABORT, 'signal_revision_conflict') END;
END;

CREATE TABLE shared_directions (
  tenant_id TEXT NOT NULL, principal_id TEXT NOT NULL, direction_id TEXT NOT NULL,
  revision INTEGER NOT NULL, created_at TEXT NOT NULL, document TEXT NOT NULL,
  PRIMARY KEY (tenant_id, principal_id, direction_id)
);
CREATE INDEX shared_directions_page ON shared_directions (tenant_id, principal_id, created_at DESC, direction_id DESC);
CREATE TABLE shared_direction_operations (
  tenant_id TEXT NOT NULL, principal_id TEXT NOT NULL, operation_id TEXT NOT NULL,
  request TEXT NOT NULL, direction_id TEXT NOT NULL, expected_revision INTEGER NOT NULL,
  result TEXT NOT NULL,
  PRIMARY KEY (tenant_id, principal_id, operation_id)
);
CREATE TRIGGER shared_direction_operation_apply AFTER INSERT ON shared_direction_operations BEGIN
  SELECT CASE WHEN NOT json_valid(NEW.result) THEN RAISE(ABORT, 'direction_document_invalid') END;
  SELECT CASE WHEN json_extract(NEW.result, '$.tenantId') IS NOT NEW.tenant_id
    OR json_extract(NEW.result, '$.principal') IS NOT NEW.principal_id
    OR json_extract(NEW.result, '$.id') IS NOT NEW.direction_id
    OR json_type(NEW.result, '$.revision') IS NOT 'integer'
    OR NEW.expected_revision < 0 OR json_extract(NEW.result, '$.revision') != NEW.expected_revision + 1
    THEN RAISE(ABORT, 'direction_document_invalid') END;
  SELECT CASE WHEN NEW.expected_revision > 0 AND EXISTS (
    SELECT 1 FROM shared_directions WHERE tenant_id = NEW.tenant_id AND principal_id = NEW.principal_id AND direction_id = NEW.direction_id
      AND created_at IS NOT json_extract(NEW.result, '$.createdAt')) THEN RAISE(ABORT, 'direction_document_invalid') END;
  INSERT INTO shared_directions (tenant_id, principal_id, direction_id, revision, created_at, document)
    SELECT NEW.tenant_id, NEW.principal_id, NEW.direction_id, 1, json_extract(NEW.result, '$.createdAt'), NEW.result
    WHERE NEW.expected_revision = 0;
  UPDATE shared_directions SET revision = revision + 1, document = NEW.result
    WHERE NEW.expected_revision > 0 AND tenant_id = NEW.tenant_id AND principal_id = NEW.principal_id
      AND direction_id = NEW.direction_id AND revision = NEW.expected_revision;
  SELECT CASE WHEN NEW.expected_revision > 0 AND changes() != 1 THEN RAISE(ABORT, 'direction_revision_conflict') END;
END;

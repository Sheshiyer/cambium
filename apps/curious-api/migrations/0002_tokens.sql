CREATE TABLE token_revocations (
  token_hash TEXT PRIMARY KEY,
  token_id TEXT NOT NULL,
  revoked_at TEXT NOT NULL,
  revoked_by TEXT NOT NULL,
  reason TEXT NOT NULL
);

CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  gate_id TEXT,
  decision TEXT NOT NULL,
  actor TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TRIGGER approvals_no_update
BEFORE UPDATE ON approvals
BEGIN
  SELECT RAISE(ABORT, 'approvals are append-only');
END;

CREATE TRIGGER approvals_no_delete
BEFORE DELETE ON approvals
BEGIN
  SELECT RAISE(ABORT, 'approvals are append-only');
END;

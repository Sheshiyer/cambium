-- Graph, token registry, and audit tables for curious-api.
-- Local D1 simulation only. This file does not create a remote database.

CREATE TABLE nodes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX nodes_tenant_kind ON nodes (tenant_id, kind, updated_at DESC);

CREATE TABLE edges (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  from_id TEXT NOT NULL,
  to_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (from_id) REFERENCES nodes (id),
  FOREIGN KEY (to_id) REFERENCES nodes (id)
);

CREATE INDEX edges_from ON edges (tenant_id, from_id);
CREATE INDEX edges_to ON edges (tenant_id, to_id);

CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  subject_id TEXT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX events_tenant_time ON events (tenant_id, created_at, id);

CREATE TRIGGER events_no_update
BEFORE UPDATE ON events
BEGIN
  SELECT RAISE(ABORT, 'events are append-only');
END;

CREATE TRIGGER events_no_delete
BEFORE DELETE ON events
BEGIN
  SELECT RAISE(ABORT, 'events are append-only');
END;

CREATE TABLE tokens (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  agent TEXT NOT NULL,
  scopes TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX tokens_agent ON tokens (agent);

CREATE TABLE audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  action TEXT NOT NULL,
  actor TEXT NOT NULL,
  subject TEXT,
  detail TEXT NOT NULL
);

CREATE INDEX audit_action_time ON audit (action, at, id);

CREATE TRIGGER audit_no_update
BEFORE UPDATE ON audit
BEGIN
  SELECT RAISE(ABORT, 'audit is append-only');
END;

CREATE TRIGGER audit_no_delete
BEFORE DELETE ON audit
BEGIN
  SELECT RAISE(ABORT, 'audit is append-only');
END;

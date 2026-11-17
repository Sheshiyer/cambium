CREATE TABLE field_expedition (
  id TEXT PRIMARY KEY,
  revision INTEGER NOT NULL,
  body TEXT NOT NULL,
  previous TEXT
);

CREATE TABLE field_records (
  source_key TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  source_id TEXT NOT NULL,
  body TEXT NOT NULL,
  content_sha256 TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE field_edges (
  id TEXT PRIMARY KEY,
  from_key TEXT NOT NULL,
  to_key TEXT NOT NULL,
  kind TEXT NOT NULL,
  body TEXT NOT NULL
);

CREATE TABLE field_sync_records (
  record_key TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  fields TEXT NOT NULL,
  revision INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE field_sync_changes (
  cursor INTEGER PRIMARY KEY AUTOINCREMENT,
  record_key TEXT NOT NULL,
  record TEXT NOT NULL
);

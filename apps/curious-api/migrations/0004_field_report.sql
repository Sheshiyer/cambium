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

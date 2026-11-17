CREATE TABLE signals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE problems (
  id TEXT PRIMARY KEY,
  signal_id TEXT NOT NULL,
  statement TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE drafts (
  id TEXT PRIMARY KEY,
  problem_id TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE gates (
  id TEXT PRIMARY KEY,
  draft_id TEXT NOT NULL,
  checks TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE receipts (
  id TEXT PRIMARY KEY,
  gate_id TEXT NOT NULL,
  approval_id TEXT NOT NULL,
  draft_hash TEXT NOT NULL,
  gate_hash TEXT NOT NULL,
  approval_hash TEXT NOT NULL,
  receipt_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE ledger_items (
  id TEXT PRIMARY KEY,
  source_path TEXT NOT NULL,
  body TEXT NOT NULL,
  body_sha256 TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE digests (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

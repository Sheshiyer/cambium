-- Native founder session transfer (cambium.native-session.v1).
-- Additive only. Stores SHA-256 digests of authorization codes and session
-- tokens. No plaintext credential columns. No scheduler is installed here.
--
-- Exchange is ONE conditional INSERT ... SELECT. The WHERE clause matches the
-- code digest, client, exact redirect, computed S256 challenge, and unexpired
-- code that has no session yet. The unique index on authorization_code_id makes a code issue at
-- most one session even when two exchanges run together. Equality in SQL is
-- not a cryptographic constant-time compare.

CREATE TABLE IF NOT EXISTS native_authorization_codes (
  code_digest TEXT PRIMARY KEY CHECK (length(code_digest) = 64 AND code_digest NOT GLOB '*[^0-9a-f]*'),
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL CHECK (length(code_challenge) = 43),
  founder_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS native_sessions (
  token_digest TEXT PRIMARY KEY CHECK (length(token_digest) = 64 AND token_digest NOT GLOB '*[^0-9a-f]*'),
  authorization_code_id TEXT NOT NULL UNIQUE REFERENCES native_authorization_codes (code_digest),
  client_id TEXT NOT NULL,
  founder_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS native_sessions_founder_idx
  ON native_sessions (founder_id, tenant_id, client_id);

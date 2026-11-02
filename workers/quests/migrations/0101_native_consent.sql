-- Explicit browser consent for native founder authorization (cambium.native-session.v1).
-- Additive only. Stores SHA-256 digests of the one-time consent intent and its
-- CSRF token. No plaintext intent, CSRF, code, or token columns. No scheduler
-- is installed here. This file is source; nothing in this packet applies it.
--
-- Consent is ONE conditional UPDATE. The WHERE clause matches the intent
-- digest, CSRF digest, founder, and the exact digest of the authorize inputs,
-- and only while consumed_at IS NULL and expires_at is still in the future.
-- changes = 1 is the only success. A replay, a different founder, a changed
-- challenge, client, tenant, redirect, or state, or an expired intent updates
-- zero rows and mints no authorization code. Equality in SQL is not a
-- cryptographic constant-time compare.

CREATE TABLE IF NOT EXISTS native_consent_intents (
  intent_digest TEXT PRIMARY KEY CHECK (length(intent_digest) = 64 AND intent_digest NOT GLOB '*[^0-9a-f]*'),
  csrf_digest TEXT NOT NULL CHECK (length(csrf_digest) = 64 AND csrf_digest NOT GLOB '*[^0-9a-f]*'),
  request_digest TEXT NOT NULL CHECK (length(request_digest) = 64 AND request_digest NOT GLOB '*[^0-9a-f]*'),
  founder_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL CHECK (length(code_challenge) = 43),
  state TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE INDEX IF NOT EXISTS native_consent_intents_founder_idx
  ON native_consent_intents (founder_id, expires_at);

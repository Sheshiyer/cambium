CREATE TABLE IF NOT EXISTS website_intake_leads (
  id TEXT PRIMARY KEY NOT NULL,
  brief_json TEXT NOT NULL CHECK (json_valid(brief_json)),
  reply_channel TEXT NOT NULL CHECK (reply_channel IN ('email', 'whatsapp')),
  reply_contact TEXT NOT NULL CHECK (length(reply_contact) BETWEEN 1 AND 254),
  consent_version TEXT NOT NULL CHECK (consent_version = 'lead-storage-90d-v1'),
  consented_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS website_intake_leads_expiry_idx
  ON website_intake_leads (expires_at);

CREATE INDEX IF NOT EXISTS website_intake_leads_created_idx
  ON website_intake_leads (created_at DESC);

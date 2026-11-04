-- Schema-only migration for the hand-authored contact endpoint.
CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  organisation TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL CHECK (subject IN ('placement', 'collaboration', 'general')),
  message TEXT NOT NULL,
  consent INTEGER NOT NULL CHECK (consent = 1),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS contact_messages_created_at_idx
  ON contact_messages (created_at);

CREATE TABLE IF NOT EXISTS contact_rate_limits (
  key TEXT PRIMARY KEY NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS contact_rate_limits_expires_at_idx
  ON contact_rate_limits (expires_at);

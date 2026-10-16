-- Initial schema for the application-owned SQLite store.
--
-- This database holds dupe-studio's own metadata (saved database instances,
-- configuration and audit log). It is unrelated to the user DBMS connections
-- managed by `src/db/`.

-- Saved connections. Credentials are NOT stored here: `secret_ref` points at
-- an OS keychain entry (see the future `keyring` integration).
CREATE TABLE database_instances (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  kind          TEXT NOT NULL,
  host          TEXT,
  port          INTEGER,
  database_name TEXT,
  username      TEXT,
  secret_ref    TEXT,
  is_favorite   INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- App configuration / preferences, stored as key/JSON-value pairs so new
-- settings do not require a migration.
CREATE TABLE app_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Audit trail. `message_key` is an i18n key (never user-facing prose) and
-- `detail` is redacted JSON.
CREATE TABLE audit_log (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  category    TEXT NOT NULL,
  action      TEXT NOT NULL,
  status      TEXT NOT NULL,
  instance_id TEXT REFERENCES database_instances (id) ON DELETE SET NULL,
  message_key TEXT,
  detail      TEXT,
  duration_ms INTEGER
);

CREATE INDEX idx_audit_log_occurred_at ON audit_log (occurred_at);
CREATE INDEX idx_audit_log_instance_id ON audit_log (instance_id);

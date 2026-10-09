-- Additive account-security layer. Existing account, role and editorial tables stay intact.
ALTER TABLE users ADD COLUMN session_version INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS account_challenges (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK(purpose IN ('EMAIL_VERIFICATION','ACCOUNT_DELETION')),
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  consumed_at TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_account_challenges_active
  ON account_challenges(user_id,purpose,created_at DESC);

CREATE TABLE IF NOT EXISTS security_rate_limits (
  bucket_hash TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at TEXT NOT NULL,
  blocked_until TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_security_rate_limits_updated
  ON security_rate_limits(updated_at);


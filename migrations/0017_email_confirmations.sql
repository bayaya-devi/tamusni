CREATE TABLE IF NOT EXISTS email_verification_tokens (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_email_verification_user ON email_verification_tokens(user_id);
CREATE TABLE IF NOT EXISTS newsletter_verification_tokens (token_hash TEXT PRIMARY KEY, email TEXT NOT NULL REFERENCES newsletter_subscribers(email) ON DELETE CASCADE, expires_at TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_newsletter_verification_email ON newsletter_verification_tokens(email);
ALTER TABLE newsletter_subscribers ADD COLUMN email_verified_at TEXT;

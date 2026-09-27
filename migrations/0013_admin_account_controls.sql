ALTER TABLE users ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_users_banned_created ON users(is_banned, created_at DESC);

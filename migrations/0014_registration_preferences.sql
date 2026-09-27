ALTER TABLE users ADD COLUMN preferred_topic TEXT;
ALTER TABLE users ADD COLUMN terms_accepted_at TEXT;
ALTER TABLE users ADD COLUMN sponsored_in_app INTEGER NOT NULL DEFAULT 0 CHECK(sponsored_in_app IN (0,1));
ALTER TABLE users ADD COLUMN sponsored_email INTEGER NOT NULL DEFAULT 0 CHECK(sponsored_email IN (0,1));
CREATE INDEX IF NOT EXISTS idx_users_preferred_topic ON users(preferred_topic);

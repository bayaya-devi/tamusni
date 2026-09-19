CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'USER' CHECK(role IN ('USER','ADMIN')), email_verified_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS newsletter_subscribers (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, locale TEXT NOT NULL DEFAULT 'fr', created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS saved_articles (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, article_slug TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (user_id, article_slug));
CREATE TABLE IF NOT EXISTS ad_placements (id TEXT PRIMARY KEY, placement TEXT NOT NULL UNIQUE, provider TEXT, slot_id TEXT, active INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);

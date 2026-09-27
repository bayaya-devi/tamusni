ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','BANNED'));

CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('ARTICLE','BREVE','VIDEO','INTERVIEW')),
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL,
  image_url TEXT,
  video_url TEXT,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','PUBLISHED')),
  author_name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','RESOLVED')),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_content_created_at ON content_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_status_created_at ON user_reports(status, created_at DESC);

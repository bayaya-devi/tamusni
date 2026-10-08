-- A role mapping keeps the existing users.role CHECK constraint intact.
CREATE TABLE IF NOT EXISTS user_roles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK(role IN ('CONTRIBUTOR')),
  assigned_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  assigned_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contributor_submissions (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK(type IN ('article','brief')),
  category TEXT NOT NULL CHECK(category IN ('Intelligence artificielle','Innovation','Robotique','Cybersécurité','Espace')),
  title TEXT NOT NULL DEFAULT '',
  slug TEXT NOT NULL DEFAULT '',
  excerpt TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  cover_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','approved','rejected')),
  review_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  submitted_at TEXT,
  reviewed_at TEXT,
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  published_content_id TEXT REFERENCES content_items(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_contributor_submissions_owner ON contributor_submissions(owner_user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_contributor_submissions_review ON contributor_submissions(status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS contributor_submission_sources (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES contributor_submissions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  publisher TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contributor_submission_sources ON contributor_submission_sources(submission_id);

ALTER TABLE content_items ADD COLUMN submitted_by_user_id TEXT REFERENCES users(id) ON DELETE SET NULL;

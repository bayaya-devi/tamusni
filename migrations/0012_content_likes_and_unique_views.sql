CREATE TABLE IF NOT EXISTS content_likes (
  actor_key TEXT NOT NULL,
  content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(actor_key, content_id)
);
CREATE INDEX IF NOT EXISTS idx_content_likes_content ON content_likes(content_id, created_at DESC);

CREATE TABLE IF NOT EXISTS content_view_sessions (
  actor_key TEXT NOT NULL,
  content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  viewed_on TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(actor_key, content_id, viewed_on)
);
CREATE INDEX IF NOT EXISTS idx_content_view_sessions_content ON content_view_sessions(content_id, viewed_on DESC);

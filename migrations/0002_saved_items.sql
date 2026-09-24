CREATE TABLE IF NOT EXISTS saved_items (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL,
  item_type TEXT NOT NULL CHECK(item_type IN ('article', 'video')),
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_saved_items_user_created ON saved_items(user_id, created_at DESC);

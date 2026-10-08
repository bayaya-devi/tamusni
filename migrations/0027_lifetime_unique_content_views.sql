-- One view per identified account or stable visitor key, for the lifetime of a content item.
CREATE TABLE IF NOT EXISTS content_unique_views (
  actor_key TEXT NOT NULL,
  content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  first_viewed_at TEXT NOT NULL,
  PRIMARY KEY(actor_key, content_id)
);
CREATE INDEX IF NOT EXISTS idx_content_unique_views_content ON content_unique_views(content_id, first_viewed_at DESC);

-- Preserve the historical first recorded view for each actor/content pair.
INSERT OR IGNORE INTO content_unique_views(actor_key,content_id,user_id,first_viewed_at)
SELECT s.actor_key,c.id,
  NULL,
  MIN(s.created_at)
FROM content_view_sessions s
JOIN content_items c ON c.id = s.content_id
GROUP BY s.actor_key,s.content_id;

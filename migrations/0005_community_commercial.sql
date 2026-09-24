ALTER TABLE polls ADD COLUMN created_by TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE polls ADD COLUMN closes_at TEXT;

CREATE TABLE IF NOT EXISTS forum_topics (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','open','locked','archived')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS forum_posts (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES forum_topics(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  parent_id TEXT REFERENCES forum_posts(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','reported')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_forum_topics_status ON forum_topics(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_topic ON forum_posts(topic_id, status, created_at);

CREATE TABLE IF NOT EXISTS advertisements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  placement TEXT NOT NULL CHECK(placement IN ('sidebar-hero','mid-page','footer-top','article-inline')),
  headline TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  target_url TEXT NOT NULL,
  advertiser TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','active','paused','ended')),
  starts_at TEXT,
  ends_at TEXT,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ads_placement_status ON advertisements(placement, status, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS content_revisions (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  editor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  snapshot_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_revisions_content ON content_revisions(content_id, created_at DESC);

INSERT OR IGNORE INTO forum_topics(id,slug,title,description,status,created_at,updated_at) VALUES
('forum-intelligence','intelligence-artificielle','Intelligence artificielle','Débattre des usages, des modèles, de la régulation et de leurs impacts.','open','2026-09-24T12:00:00Z','2026-09-24T12:00:00Z'),
('forum-espace','espace','Espace','Échanger autour des missions, technologies spatiales et enjeux orbitaux.','open','2026-09-24T12:00:00Z','2026-09-24T12:00:00Z'),
('forum-cyber','cybersecurite','Cybersécurité','Partager des analyses et bonnes pratiques sans publier de données sensibles.','open','2026-09-24T12:00:00Z','2026-09-24T12:00:00Z');

INSERT OR IGNORE INTO polls(id,question,options_json,active,created_at,closes_at) VALUES
('poll-editorial-priority','Quel sujet TAMUSNI devrait-il approfondir en priorité ?', '["Intelligence artificielle","Énergie et climat","Espace","Cybersécurité"]',1,'2026-09-24T12:00:00Z','2026-12-31T23:59:59Z');

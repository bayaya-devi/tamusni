-- TAMUSNI editorial automation. D1 remains the source of truth for the
-- publishing cycle; no credential or provider token is stored in this schema.

ALTER TABLE content_items ADD COLUMN automated INTEGER NOT NULL DEFAULT 0;
ALTER TABLE content_items ADD COLUMN automation_run_id TEXT;
ALTER TABLE content_items ADD COLUMN fact_sheet_json TEXT;
ALTER TABLE content_items ADD COLUMN image_disclosure TEXT;

CREATE TABLE IF NOT EXISTS content_translations (
  content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK(locale IN ('fr','en','ar')),
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  ai_disclosure TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(content_id, locale)
);

CREATE TABLE IF NOT EXISTS editorial_cycle_state (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  cycle_type TEXT NOT NULL CHECK(cycle_type IN ('brief','article')) DEFAULT 'brief',
  cycle_number INTEGER NOT NULL DEFAULT 1,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS editorial_cycle_categories (
  cycle_number INTEGER NOT NULL,
  category TEXT NOT NULL,
  ordinal INTEGER NOT NULL,
  completed_at TEXT,
  deferred_count INTEGER NOT NULL DEFAULT 0,
  last_attempt_at TEXT,
  PRIMARY KEY(cycle_number, category)
);

CREATE TABLE IF NOT EXISTS editorial_runs (
  id TEXT PRIMARY KEY,
  local_date TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK(purpose IN ('prepare','publish')),
  status TEXT NOT NULL CHECK(status IN ('running','no_topic','ready','published','failed','content_ready_but_not_public')),
  cycle_type TEXT,
  category TEXT,
  content_id TEXT REFERENCES content_items(id) ON DELETE SET NULL,
  selected_topic TEXT,
  error_code TEXT,
  error_detail TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  UNIQUE(local_date, purpose)
);

CREATE TABLE IF NOT EXISTS editorial_logs (
  id TEXT PRIMARY KEY,
  run_id TEXT REFERENCES editorial_runs(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_editorial_logs_run ON editorial_logs(run_id, created_at);

CREATE TABLE IF NOT EXISTS editorial_source_feeds (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  publisher TEXT NOT NULL,
  feed_url TEXT NOT NULL UNIQUE,
  tier INTEGER NOT NULL DEFAULT 1 CHECK(tier BETWEEN 1 AND 9),
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS editorial_candidates (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES editorial_runs(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  publisher TEXT NOT NULL,
  published_at TEXT,
  source_tier INTEGER NOT NULL,
  selected INTEGER NOT NULL DEFAULT 0,
  rejection_reason TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(run_id, url)
);

CREATE INDEX IF NOT EXISTS idx_editorial_candidates_run ON editorial_candidates(run_id, category, selected);
CREATE INDEX IF NOT EXISTS idx_content_automation_run ON content_items(automation_run_id);

INSERT OR IGNORE INTO editorial_cycle_state(id,cycle_type,cycle_number,started_at,updated_at)
VALUES(1,'brief',1,'2026-10-01T00:00:00.000Z','2026-10-01T00:00:00.000Z');

INSERT OR IGNORE INTO editorial_cycle_categories(cycle_number,category,ordinal) VALUES
  (1,'Intelligence',1),(1,'Innovation',2),(1,'Robotique',3),(1,'Cybersécurité',4),(1,'Espace',5);

-- These are discovery feeds, not automatic proof. The workflow separately
-- checks each selected primary URL before it may be published.
INSERT OR IGNORE INTO editorial_source_feeds(id,category,publisher,feed_url,tier,created_at,updated_at) VALUES
  ('feed-nasa','Espace','NASA','https://www.nasa.gov/rss/dyn/breaking_news.rss',1,'2026-10-01T00:00:00.000Z','2026-10-01T00:00:00.000Z'),
  ('feed-esa','Espace','ESA','https://www.esa.int/rssfeed/Our_Activities/Space_Safety',1,'2026-10-01T00:00:00.000Z','2026-10-01T00:00:00.000Z'),
  ('feed-cisa','Cybersécurité','CISA','https://www.cisa.gov/cybersecurity-advisories/all.xml',3,'2026-10-01T00:00:00.000Z','2026-10-01T00:00:00.000Z'),
  ('feed-nist','Cybersécurité','NIST','https://www.nist.gov/news-events/cybersecurity/rss.xml',3,'2026-10-01T00:00:00.000Z','2026-10-01T00:00:00.000Z'),
  ('feed-openai','Intelligence','OpenAI','https://openai.com/news/rss.xml',1,'2026-10-01T00:00:00.000Z','2026-10-01T00:00:00.000Z'),
  ('feed-google-ai','Intelligence','Google AI','https://blog.google/technology/ai/rss/',1,'2026-10-01T00:00:00.000Z','2026-10-01T00:00:00.000Z'),
  ('feed-mit','Robotique','MIT News','https://news.mit.edu/rss/topic/robotics',5,'2026-10-01T00:00:00.000Z','2026-10-01T00:00:00.000Z'),
  ('feed-ieee','Robotique','IEEE Spectrum','https://spectrum.ieee.org/feeds/topic/robotics.rss',7,'2026-10-01T00:00:00.000Z','2026-10-01T00:00:00.000Z'),
  ('feed-iea','Innovation','Agence internationale de l''énergie','https://www.iea.org/news/rss',3,'2026-10-01T00:00:00.000Z','2026-10-01T00:00:00.000Z'),
  ('feed-eu','Innovation','Commission européenne','https://ec.europa.eu/commission/presscorner/api/rss?language=en',3,'2026-10-01T00:00:00.000Z','2026-10-01T00:00:00.000Z');

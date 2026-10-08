-- TAMUSNI WATCH v2: durable 48-hour cadence, richer source metadata and
-- generated editorial media. Existing runs and logs are intentionally kept.
ALTER TABLE editorial_cycle_state ADD COLUMN next_publication_local_date TEXT;
ALTER TABLE editorial_cycle_state ADD COLUMN last_publication_at TEXT;
ALTER TABLE editorial_cycle_state ADD COLUMN last_public_url TEXT;
ALTER TABLE editorial_cycle_state ADD COLUMN deployment_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE editorial_runs ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 1;
ALTER TABLE editorial_runs ADD COLUMN public_url TEXT;
ALTER TABLE editorial_runs ADD COLUMN quality_report_json TEXT;

ALTER TABLE editorial_source_feeds ADD COLUMN homepage_url TEXT;
ALTER TABLE editorial_source_feeds ADD COLUMN source_type TEXT NOT NULL DEFAULT 'rss';
ALTER TABLE editorial_source_feeds ADD COLUMN last_checked_at TEXT;
ALTER TABLE editorial_source_feeds ADD COLUMN last_status TEXT;

CREATE TABLE IF NOT EXISTS editorial_media (
  media_key TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  data_base64 TEXT NOT NULL,
  alt_text TEXT NOT NULL,
  disclosure TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- The first production cycle required by the specification is ARTICLES.
UPDATE editorial_cycle_state
SET cycle_type='article',
    cycle_number=2,
    next_publication_local_date='2026-10-09',
    updated_at=CURRENT_TIMESTAMP,
    deployment_status='scheduled'
WHERE id=1 AND cycle_number=1;

INSERT OR IGNORE INTO editorial_cycle_categories(cycle_number,category,ordinal) VALUES
  (2,'Intelligence',1),
  (2,'Innovation',2),
  (2,'Robotique',3),
  (2,'Cybersécurité',4),
  (2,'Espace',5);

UPDATE editorial_source_feeds SET feed_url='https://blog.google/innovation-and-ai/technology/ai/rss/', updated_at=CURRENT_TIMESTAMP WHERE id='feed-google-ai';
UPDATE editorial_source_feeds SET feed_url='https://www.nasa.gov/news-release/feed/', updated_at=CURRENT_TIMESTAMP WHERE id='feed-nasa';
UPDATE editorial_source_feeds SET feed_url='https://news.mit.edu/topic/mitrobotics-rss.xml', updated_at=CURRENT_TIMESTAMP WHERE id='feed-mit';
UPDATE editorial_source_feeds SET active=0, last_status='disabled: feed returned 404', updated_at=CURRENT_TIMESTAMP WHERE id='feed-iea';

INSERT OR IGNORE INTO editorial_source_feeds(id,category,publisher,feed_url,tier,active,created_at,updated_at,homepage_url,source_type) VALUES
  ('feed-mit-ai','Intelligence','MIT News','https://news.mit.edu/topic/mitartificial-intelligence2-rss.xml',4,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'https://news.mit.edu/topic/artificial-intelligence2','rss'),
  ('feed-mit-space','Espace','MIT News','https://news.mit.edu/topic/mitspace-rss.xml',4,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'https://news.mit.edu/topic/space','rss'),
  ('feed-google-security','Cybersécurité','Google Security Blog','https://feeds.feedburner.com/GoogleOnlineSecurityBlog',1,1,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'https://security.googleblog.com/','rss');

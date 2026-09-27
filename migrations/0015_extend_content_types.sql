PRAGMA foreign_keys=OFF;

CREATE TABLE content_items_new (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('article','brief','video','interview','podcast')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','scheduled','published','archived')),
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  author_name TEXT NOT NULL DEFAULT 'Rédaction TAMUSNI',
  cover_url TEXT,
  media_url TEXT,
  transcript TEXT,
  subtitles_url TEXT,
  fact_check_status TEXT NOT NULL DEFAULT 'verified' CHECK(fact_check_status IN ('verified','context','correction','opinion')),
  sponsored INTEGER NOT NULL DEFAULT 0,
  sponsor_name TEXT,
  published_at TEXT,
  scheduled_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO content_items_new SELECT * FROM content_items;
DROP TABLE content_items;
ALTER TABLE content_items_new RENAME TO content_items;
CREATE INDEX idx_content_status_published ON content_items(status, published_at DESC);
CREATE INDEX idx_content_category ON content_items(category, published_at DESC);
CREATE INDEX idx_content_type ON content_items(type, published_at DESC);
PRAGMA foreign_keys=ON;

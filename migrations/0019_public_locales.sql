-- Spanish and Portuguese translations are additive. Existing content and
-- fr/en/ar translation records remain untouched.
CREATE TABLE IF NOT EXISTS content_translations_extra (
  content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK(locale IN ('es','pt')),
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY(content_id, locale)
);
CREATE INDEX IF NOT EXISTS idx_content_translations_extra_locale ON content_translations_extra(locale);

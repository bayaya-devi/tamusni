ALTER TABLE newsletter_subscribers ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE newsletter_subscribers ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE newsletter_subscribers ADD COLUMN subscribed_at TEXT;
ALTER TABLE newsletter_subscribers ADD COLUMN unsubscribed_at TEXT;
ALTER TABLE newsletter_subscribers ADD COLUMN updated_at TEXT;
ALTER TABLE newsletter_subscribers ADD COLUMN brevo_contact_id TEXT;
ALTER TABLE newsletter_subscribers ADD COLUMN brevo_sync_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE newsletter_subscribers ADD COLUMN source TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE newsletter_subscribers ADD COLUMN brevo_previous_email TEXT;

UPDATE newsletter_subscribers
SET status=CASE WHEN email_verified_at IS NOT NULL THEN 'active' ELSE 'pending' END,
    subscribed_at=COALESCE(email_verified_at,created_at),
    updated_at=COALESCE(email_verified_at,created_at),
    user_id=(SELECT id FROM users WHERE lower(users.email)=lower(newsletter_subscribers.email) LIMIT 1);

CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_subscribers_user ON newsletter_subscribers(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_newsletter_subscribers_status_locale ON newsletter_subscribers(status,locale);

CREATE TABLE IF NOT EXISTS newsletter_intents (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  locale TEXT NOT NULL CHECK(locale IN ('fr','ar','en','es','pt')),
  ip_hash TEXT,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_newsletter_intents_expiry ON newsletter_intents(expires_at);

CREATE TABLE IF NOT EXISTS newsletter_runs (
  cycle_key TEXT PRIMARY KEY,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PREPARING',
  lock_token TEXT,
  lock_expires_at TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  error_detail TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS newsletter_editions (
  id TEXT PRIMARY KEY,
  edition_key TEXT NOT NULL UNIQUE,
  cycle_key TEXT NOT NULL REFERENCES newsletter_runs(cycle_key) ON DELETE CASCADE,
  locale TEXT NOT NULL CHECK(locale IN ('fr','ar','en','es','pt')),
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  subject TEXT NOT NULL,
  preheader TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PREPARING',
  brevo_campaign_id TEXT,
  subscriber_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER,
  delivered_count INTEGER,
  open_count INTEGER,
  click_count INTEGER,
  bounce_count INTEGER,
  error_count INTEGER,
  unsubscribe_count INTEGER,
  html_hash TEXT,
  text_hash TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  error_detail TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sent_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_newsletter_editions_cycle ON newsletter_editions(cycle_key,locale);
CREATE INDEX IF NOT EXISTS idx_newsletter_editions_status ON newsletter_editions(status,created_at DESC);

CREATE TABLE IF NOT EXISTS newsletter_edition_items (
  edition_id TEXT NOT NULL REFERENCES newsletter_editions(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL,
  is_highlight INTEGER NOT NULL DEFAULT 0,
  score REAL NOT NULL,
  PRIMARY KEY(edition_id,content_id),
  UNIQUE(edition_id,position)
);

CREATE TABLE IF NOT EXISTS newsletter_events (
  event_key TEXT PRIMARY KEY,
  campaign_id TEXT,
  event_type TEXT NOT NULL,
  email_hash TEXT,
  url TEXT,
  event_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_newsletter_events_campaign ON newsletter_events(campaign_id,event_type);

CREATE TABLE IF NOT EXISTS newsletter_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

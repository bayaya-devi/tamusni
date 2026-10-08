-- Durable social distribution queue. Credentials remain Cloudflare secrets.
CREATE TABLE IF NOT EXISTS social_accounts (
  platform TEXT PRIMARY KEY CHECK(platform IN ('x','instagram','facebook','youtube')),
  display_name TEXT NOT NULL,
  public_url TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'PAUSED' CHECK(mode IN ('AUTO','MANUAL','PAUSED')),
  connection_status TEXT NOT NULL DEFAULT 'NOT_CONNECTED' CHECK(connection_status IN ('NOT_CONNECTED','CONNECTED','DEGRADED','EXPIRED')),
  account_external_id TEXT,
  last_health_at TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS social_publications (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK(platform IN ('x','instagram','facebook','youtube')),
  version INTEGER NOT NULL DEFAULT 1,
  locale TEXT NOT NULL DEFAULT 'fr',
  status TEXT NOT NULL CHECK(status IN ('PENDING','PREPARING','READY','SCHEDULED','PUBLISHING','PUBLISHED','FAILED','CANCELLED','SKIPPED')),
  scheduled_for TEXT,
  social_text TEXT,
  canonical_url TEXT,
  media_url TEXT,
  external_id TEXT,
  external_url TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 4,
  next_retry_at TEXT,
  last_error_code TEXT,
  last_error_detail TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  UNIQUE(content_id, platform, version)
);
CREATE INDEX IF NOT EXISTS idx_social_due ON social_publications(status, scheduled_for, next_retry_at);
CREATE INDEX IF NOT EXISTS idx_social_content ON social_publications(content_id, version DESC);

CREATE TABLE IF NOT EXISTS social_attempts (
  id TEXT PRIMARY KEY,
  publication_id TEXT NOT NULL REFERENCES social_publications(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('DRY_RUN','SUCCESS','RETRY','PERMANENT_FAILURE')),
  http_status INTEGER,
  error_code TEXT,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_social_attempts_publication ON social_attempts(publication_id, created_at DESC);

CREATE TABLE IF NOT EXISTS social_media_assets (
  id TEXT PRIMARY KEY,
  publication_id TEXT NOT NULL REFERENCES social_publications(id) ON DELETE CASCADE,
  source_url TEXT NOT NULL,
  platform TEXT NOT NULL,
  aspect_ratio TEXT,
  alt_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'READY' CHECK(status IN ('PREPARING','READY','FAILED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS social_events (
  id TEXT PRIMARY KEY,
  publication_id TEXT REFERENCES social_publications(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_social_events_created ON social_events(created_at DESC);

INSERT OR IGNORE INTO social_accounts(platform,display_name,public_url,mode,connection_status,updated_at) VALUES
  ('x','X','https://x.com/getbnhdh89514','MANUAL','NOT_CONNECTED',datetime('now')),
  ('instagram','Instagram','https://www.instagram.com/tam.usni/','MANUAL','NOT_CONNECTED',datetime('now')),
  ('facebook','Facebook','https://web.facebook.com/profile.php?id=61595345005345','MANUAL','NOT_CONNECTED',datetime('now')),
  ('youtube','YouTube','https://www.youtube.com/@Tamusni-i7h','PAUSED','NOT_CONNECTED',datetime('now'));

-- These triggers affect only future publication transitions: no historical backfill.
CREATE TRIGGER IF NOT EXISTS social_enqueue_after_content_insert
AFTER INSERT ON content_items WHEN NEW.status='published'
BEGIN
  INSERT OR IGNORE INTO social_publications(id,content_id,platform,version,status,created_at,updated_at)
    SELECT lower(hex(randomblob(16))),NEW.id,platform,1,CASE WHEN platform='youtube' THEN 'SKIPPED' ELSE 'PENDING' END,datetime('now'),datetime('now') FROM social_accounts;
END;

CREATE TRIGGER IF NOT EXISTS social_enqueue_after_publish
AFTER UPDATE OF status ON content_items WHEN NEW.status='published' AND OLD.status<>'published'
BEGIN
  INSERT OR IGNORE INTO social_publications(id,content_id,platform,version,status,created_at,updated_at)
    SELECT lower(hex(randomblob(16))),NEW.id,platform,COALESCE((SELECT MAX(version)+1 FROM social_publications WHERE content_id=NEW.id AND platform=social_accounts.platform),1),CASE WHEN platform='youtube' THEN 'SKIPPED' ELSE 'PENDING' END,datetime('now'),datetime('now') FROM social_accounts;
END;

CREATE TRIGGER IF NOT EXISTS social_regenerate_after_published_edit
AFTER UPDATE OF title,excerpt,body,cover_url,slug ON content_items WHEN NEW.status='published' AND OLD.status='published'
BEGIN
  UPDATE social_publications SET status='CANCELLED',last_error_code='SUPERSEDED',updated_at=datetime('now') WHERE content_id=NEW.id AND status IN ('PENDING','PREPARING','READY','SCHEDULED','FAILED');
  INSERT OR IGNORE INTO social_publications(id,content_id,platform,version,status,created_at,updated_at)
    SELECT lower(hex(randomblob(16))),NEW.id,platform,COALESCE((SELECT MAX(version)+1 FROM social_publications WHERE content_id=NEW.id AND platform=social_accounts.platform),1),CASE WHEN platform='youtube' THEN 'SKIPPED' ELSE 'PENDING' END,datetime('now'),datetime('now') FROM social_accounts;
  INSERT INTO admin_notifications(id,type,title,body,target_url,target_type,target_id,created_at)
    SELECT lower(hex(randomblob(16))),'social','Contenu déjà diffusé modifié','Vérifiez les publications sociales déjà en ligne pour : '||NEW.title,'/fr/admin/#social','content',NEW.id,datetime('now')
    WHERE EXISTS(SELECT 1 FROM social_publications WHERE content_id=NEW.id AND status='PUBLISHED');
END;

CREATE TRIGGER IF NOT EXISTS social_cancel_after_unpublish
AFTER UPDATE OF status ON content_items WHEN OLD.status='published' AND NEW.status<>'published'
BEGIN
  UPDATE social_publications SET status='CANCELLED',last_error_code='CONTENT_UNPUBLISHED',updated_at=datetime('now') WHERE content_id=NEW.id AND status NOT IN ('PUBLISHED','CANCELLED','SKIPPED');
  INSERT INTO admin_notifications(id,type,title,body,target_url,target_type,target_id,created_at)
    SELECT lower(hex(randomblob(16))),'social','Contenu retiré après diffusion','Une publication sociale existe encore pour : '||NEW.title,'/fr/admin/#social','content',NEW.id,datetime('now')
    WHERE EXISTS(SELECT 1 FROM social_publications WHERE content_id=NEW.id AND status='PUBLISHED');
END;

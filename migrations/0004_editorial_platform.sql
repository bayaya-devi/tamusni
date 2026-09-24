ALTER TABLE users ADD COLUMN avatar_url TEXT;
ALTER TABLE users ADD COLUMN bio TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN preferred_language TEXT NOT NULL DEFAULT 'fr';
ALTER TABLE users ADD COLUMN preferred_theme TEXT NOT NULL DEFAULT 'auto';
ALTER TABLE users ADD COLUMN text_size TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE users ADD COLUMN display_density TEXT NOT NULL DEFAULT 'comfortable';
ALTER TABLE users ADD COLUMN notifications_enabled INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL CHECK(type IN ('article','video','podcast')),
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
CREATE INDEX IF NOT EXISTS idx_content_status_published ON content_items(status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_category ON content_items(category, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_type ON content_items(type, published_at DESC);

CREATE TABLE IF NOT EXISTS content_sources (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  publisher TEXT NOT NULL DEFAULT '',
  published_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_content_sources_content ON content_sources(content_id);

CREATE TABLE IF NOT EXISTS content_timeline_events (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  event_date TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_timeline_content ON content_timeline_events(content_id, position, event_date);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS content_tags (
  content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY(content_id, tag_id)
);

CREATE TABLE IF NOT EXISTS reading_history (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
  last_read_at TEXT NOT NULL,
  PRIMARY KEY(user_id, content_id)
);
CREATE INDEX IF NOT EXISTS idx_history_user_date ON reading_history(user_id, last_read_at DESC);

CREATE TABLE IF NOT EXISTS content_views (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  viewed_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_views_content_date ON content_views(content_id, viewed_at DESC);

CREATE TABLE IF NOT EXISTS topic_subscriptions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id, topic)
);

CREATE TABLE IF NOT EXISTS reactions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  reaction TEXT NOT NULL CHECK(reaction IN ('utile','clair','surprenant','important')),
  created_at TEXT NOT NULL,
  PRIMARY KEY(user_id, content_id)
);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','reported')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_content_status ON comments(content_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  reporter_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK(target_type IN ('content','comment')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','reviewing','closed')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS playlist_items (
  playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY(playlist_id, content_id)
);

CREATE TABLE IF NOT EXISTS search_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  searched_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id, searched_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '/',
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id TEXT PRIMARY KEY,
  admin_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_created ON admin_audit_log(created_at DESC);

CREATE TABLE IF NOT EXISTS login_attempts (
  key_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL DEFAULT 0,
  window_started_at TEXT NOT NULL,
  blocked_until TEXT
);

CREATE TABLE IF NOT EXISTS polls (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  options_json TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS poll_votes (
  poll_id TEXT NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option_index INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(poll_id, user_id)
);

INSERT OR IGNORE INTO tags(id,slug,name) VALUES
('tag-ai-act','ai-act','AI Act'),
('tag-europe','europe','Europe'),
('tag-batteries','batteries','Batteries'),
('tag-energy','energie','Énergie'),
('tag-space','espace','Espace'),
('tag-safety','securite','Sécurité');

INSERT OR IGNORE INTO content_items(id,slug,type,status,title,excerpt,body,summary,category,author_name,fact_check_status,published_at,created_at,updated_at) VALUES
('content-ai-act','ai-act-transparence-2026','article','published','AI Act : ce qui change pour la transparence en 2026','Les nouvelles obligations européennes imposent davantage d’information sur certains systèmes et contenus générés par IA.','Le règlement européen sur l’intelligence artificielle entre progressivement en application. Les obligations de transparence concernent notamment certains systèmes interactifs et contenus synthétiques. Leur portée dépend du type de système, de son usage et de sa date de mise sur le marché.','Les obligations de transparence de l’AI Act deviennent applicables progressivement et doivent être vérifiées selon le système concerné.','Intelligence','Rédaction TAMUSNI','verified','2026-09-24T08:00:00Z','2026-09-24T08:00:00Z','2026-09-24T08:00:00Z'),
('content-battery','stockage-batteries-2025','article','published','Le stockage par batteries poursuit sa progression','Les ajouts de capacité se sont accélérés et s’étendent à davantage de régions.','Les batteries occupent une place croissante dans les réseaux électriques, pour intégrer les renouvelables, sécuriser l’approvisionnement et soutenir de nouveaux usages comme les centres de données. Les résultats varient toutefois selon les marchés, les réseaux et les modèles économiques.','Le stockage progresse rapidement, mais son impact dépend du réseau, du marché et de l’usage réel.','Innovation','Rédaction TAMUSNI','verified','2026-09-23T08:00:00Z','2026-09-23T08:00:00Z','2026-09-23T08:00:00Z'),
('content-debris','debris-orbitaux-fin-de-mission','article','published','Débris orbitaux : préparer la fin de mission dès la conception','Les standards de mitigation demandent d’évaluer les risques et la stratégie de retrait avant le lancement.','La réduction des débris orbitaux ne se limite pas aux opérations en vol. Les exigences de la NASA prévoient une évaluation formelle des risques de génération de débris pendant le déploiement, les opérations et après la mission. La stratégie de fin de mission doit donc être intégrée à la conception.','La fin de mission et la limitation des débris doivent être planifiées dès la conception du système spatial.','Espace','Rédaction TAMUSNI','verified','2026-09-22T08:00:00Z','2026-09-22T08:00:00Z','2026-09-22T08:00:00Z');

INSERT OR IGNORE INTO content_sources(id,content_id,label,url,publisher,published_at,created_at) VALUES
('source-ai-act','content-ai-act','Cadre réglementaire européen sur l’IA','https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai','Commission européenne','2026-08-02','2026-09-24T08:00:00Z'),
('source-battery','content-battery','Global Energy Review 2026 — Battery storage','https://www.iea.org/reports/global-energy-review-2026/technology-battery-storage','Agence internationale de l’énergie','2026-01-01','2026-09-24T08:00:00Z'),
('source-debris','content-debris','Process for Limiting Orbital Debris','https://standards.nasa.gov/node/272','NASA','2021-11-05','2026-09-24T08:00:00Z');

INSERT OR IGNORE INTO content_tags(content_id,tag_id) VALUES
('content-ai-act','tag-ai-act'),('content-ai-act','tag-europe'),
('content-battery','tag-batteries'),('content-battery','tag-energy'),
('content-debris','tag-space'),('content-debris','tag-safety');

INSERT OR IGNORE INTO content_timeline_events(id,content_id,event_date,title,description,position) VALUES
('timeline-ai-1','content-ai-act','2024-08-01','Entrée en vigueur','Le règlement européen sur l’intelligence artificielle entre en vigueur.',1),
('timeline-ai-2','content-ai-act','2025-02-02','Premières règles applicables','Les interdictions et obligations relatives à la culture de l’IA commencent à s’appliquer.',2),
('timeline-ai-3','content-ai-act','2025-08-02','Gouvernance et modèles généralistes','Les règles de gouvernance et certaines obligations visant les modèles d’IA à usage général deviennent applicables.',3),
('timeline-ai-4','content-ai-act','2026-08-02','Transparence et contrôle','De nouvelles obligations de transparence et des pouvoirs de contrôle entrent en application.',4);

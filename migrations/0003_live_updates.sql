CREATE TABLE IF NOT EXISTS live_updates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '/',
  display_time TEXT NOT NULL,
  published_at TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_live_updates_published ON live_updates(active, published_at DESC);
INSERT OR IGNORE INTO live_updates (id,title,category,url,display_time,published_at) VALUES
('live-ai-act-2026','AI Act : les obligations de transparence entrent dans leur phase d’application','Intelligence','/#homepage-2','31 juil.','2026-07-31T08:00:00Z'),
('live-battery-2026','Le stockage par batteries a franchi un nouveau cap en 2025','Innovation','/#homepage-1','20 avr.','2026-04-20T08:00:00Z'),
('live-orbit-2026','Débris orbitaux : prévoir la fin de mission dès la conception','Espace','/#homepage-3','10 avr.','2026-04-10T08:00:00Z'),
('live-nasa-2026','La NASA met à jour son outil d’évaluation des débris orbitaux','Sciences','/#homepage-4','10 avr.','2026-04-10T07:00:00Z');

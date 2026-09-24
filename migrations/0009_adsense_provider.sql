ALTER TABLE advertisements ADD COLUMN provider TEXT NOT NULL DEFAULT 'direct' CHECK(provider IN ('direct','adsense'));
ALTER TABLE advertisements ADD COLUMN adsense_client TEXT;
ALTER TABLE advertisements ADD COLUMN adsense_slot TEXT;
ALTER TABLE advertisements ADD COLUMN adsense_format TEXT;
CREATE INDEX IF NOT EXISTS idx_ads_provider_status ON advertisements(provider, status, starts_at, ends_at);

ALTER TABLE advertisements ADD COLUMN ad_type TEXT NOT NULL DEFAULT 'native'
  CHECK(ad_type IN ('display','native','sponsored','affiliate','house'));
CREATE INDEX IF NOT EXISTS idx_ads_type_status ON advertisements(ad_type, status, starts_at, ends_at);

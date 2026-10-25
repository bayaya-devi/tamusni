-- TAMUSNI Business: verified companies, campaigns, payments and measured delivery.
CREATE TABLE IF NOT EXISTS business_profiles (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  legal_name TEXT NOT NULL,
  trading_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL,
  country TEXT NOT NULL,
  city TEXT NOT NULL DEFAULT '',
  website_url TEXT NOT NULL,
  professional_email TEXT NOT NULL,
  phone TEXT,
  tax_id TEXT,
  contact_name TEXT NOT NULL,
  contact_role TEXT NOT NULL,
  logo_url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK(verification_status IN ('incomplete','pending','verified','changes_requested','refused','suspended')),
  review_reason TEXT,
  max_active_campaigns INTEGER NOT NULL DEFAULT 10 CHECK(max_active_campaigns BETWEEN 0 AND 100),
  verified_at TEXT,
  verified_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_business_profiles_status ON business_profiles(verification_status,updated_at DESC);

CREATE TABLE IF NOT EXISTS business_campaigns (
  id TEXT PRIMARY KEY,
  business_user_id TEXT NOT NULL REFERENCES business_profiles(user_id) ON DELETE CASCADE,
  campaign_type TEXT NOT NULL CHECK(campaign_type IN ('sponsored_distribution','editorial_support')),
  content_type TEXT NOT NULL CHECK(content_type IN ('product','service','offer','solution','project','innovation','event','editorial_support','other')),
  title TEXT NOT NULL,
  short_description TEXT NOT NULL DEFAULT '',
  detailed_description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  destination_url TEXT NOT NULL,
  cta TEXT NOT NULL DEFAULT 'En savoir plus',
  industry TEXT NOT NULL,
  objective TEXT NOT NULL,
  audience_json TEXT NOT NULL DEFAULT '[]',
  countries_json TEXT NOT NULL DEFAULT '[]',
  languages_json TEXT NOT NULL DEFAULT '["fr"]',
  duration_days INTEGER NOT NULL CHECK(duration_days BETWEEN 1 AND 30),
  price_cents INTEGER NOT NULL CHECK(price_cents BETWEEN 100 AND 3000),
  currency TEXT NOT NULL DEFAULT 'EUR' CHECK(currency='EUR'),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','submitted','changes_requested','approved','awaiting_payment','paid','scheduled','active','suspended','completed','refused')),
  start_mode TEXT CHECK(start_mode IN ('immediate','scheduled')),
  scheduled_start_at TEXT,
  started_at TEXT,
  ends_at TEXT,
  review_reason TEXT,
  approved_at TEXT,
  approved_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  paid_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_business_campaign_owner ON business_campaigns(business_user_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_business_campaign_delivery ON business_campaigns(status,scheduled_start_at,ends_at);

CREATE TABLE IF NOT EXISTS business_campaign_events (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES business_campaigns(id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_business_events_campaign ON business_campaign_events(campaign_id,created_at DESC);

CREATE TABLE IF NOT EXISTS business_payments (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES business_campaigns(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK(provider IN ('stripe','paypal')),
  provider_reference TEXT UNIQUE,
  idempotency_key TEXT NOT NULL UNIQUE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL CHECK(status IN ('created','pending','paid','failed','refunded')),
  failure_code TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  paid_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_business_payments_campaign ON business_payments(campaign_id,created_at DESC);

CREATE TABLE IF NOT EXISTS business_invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL UNIQUE,
  business_user_id TEXT NOT NULL REFERENCES business_profiles(user_id) ON DELETE RESTRICT,
  campaign_id TEXT NOT NULL REFERENCES business_campaigns(id) ON DELETE RESTRICT,
  payment_id TEXT NOT NULL UNIQUE REFERENCES business_payments(id) ON DELETE RESTRICT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL DEFAULT 'issued' CHECK(status IN ('issued','void')),
  issued_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_business_invoices_owner ON business_invoices(business_user_id,issued_at DESC);

CREATE TABLE IF NOT EXISTS business_notifications (
  id TEXT PRIMARY KEY,
  business_user_id TEXT NOT NULL REFERENCES business_profiles(user_id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  target_url TEXT NOT NULL DEFAULT '/business/espace/',
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_business_notifications_owner ON business_notifications(business_user_id,created_at DESC);

CREATE TABLE IF NOT EXISTS business_campaign_metrics (
  campaign_id TEXT NOT NULL REFERENCES business_campaigns(id) ON DELETE CASCADE,
  metric_date TEXT NOT NULL,
  impressions_provisional INTEGER NOT NULL DEFAULT 0,
  impressions_consolidated INTEGER NOT NULL DEFAULT 0,
  clicks_provisional INTEGER NOT NULL DEFAULT 0,
  clicks_consolidated INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  consolidated_at TEXT,
  PRIMARY KEY(campaign_id,metric_date)
);

CREATE TABLE IF NOT EXISTS business_delivery_events (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES business_campaigns(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK(event_type IN ('impression','click')),
  event_key TEXT NOT NULL UNIQUE,
  page_path TEXT NOT NULL,
  locale TEXT NOT NULL,
  device_class TEXT NOT NULL DEFAULT 'unknown',
  country_code TEXT,
  visible_ms INTEGER,
  filtered INTEGER NOT NULL DEFAULT 0,
  filter_reason TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_business_delivery_campaign ON business_delivery_events(campaign_id,event_type,created_at DESC);

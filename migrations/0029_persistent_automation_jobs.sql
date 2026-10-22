-- A scheduler is only a wake-up signal.  D1 retains all work that is due,
-- including retries, so an unavailable provider cannot silently erase work.
CREATE TABLE IF NOT EXISTS automation_jobs (
  id TEXT PRIMARY KEY,
  job_type TEXT NOT NULL CHECK(job_type IN ('editorial_publication','weekly_newsletter','weekly_maintenance')),
  idempotency_key TEXT NOT NULL UNIQUE,
  scheduled_for TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','running','completed','failed','retry_pending')) DEFAULT 'pending',
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at TEXT,
  result_json TEXT,
  metadata_json TEXT,
  lock_token TEXT,
  lock_expires_at TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_due ON automation_jobs(job_type,status,next_attempt_at,scheduled_for);
CREATE INDEX IF NOT EXISTS idx_automation_jobs_lock ON automation_jobs(status,lock_expires_at);

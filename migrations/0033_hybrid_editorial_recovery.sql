-- Hybrid editorial recovery: Cloudflare remains the durable scheduler while a
-- deliberately scoped local agent may claim and complete editorial jobs.
ALTER TABLE automation_jobs ADD COLUMN claimed_by TEXT;
ALTER TABLE automation_jobs ADD COLUMN generation_source TEXT;
ALTER TABLE automation_jobs ADD COLUMN publication_id TEXT;
ALTER TABLE automation_jobs ADD COLUMN last_attempt_at TEXT;
ALTER TABLE automation_jobs ADD COLUMN waiting_reason TEXT;

CREATE TABLE IF NOT EXISTS automation_agent_heartbeats (
  agent_id TEXT PRIMARY KEY,
  agent_kind TEXT NOT NULL,
  version TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('online','busy','offline','error')),
  capabilities_json TEXT NOT NULL DEFAULT '{}',
  last_seen_at TEXT NOT NULL,
  last_job_id TEXT,
  detail TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_automation_jobs_recovery
  ON automation_jobs(job_type,status,scheduled_for,next_attempt_at);

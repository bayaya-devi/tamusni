/**
 * Shared durable-job primitives for every TAMUSNI scheduler.
 * This module deliberately contains no provider secrets or provider-specific
 * behaviour: D1 is the source of truth and a scheduler is only a wake-up.
 */
export const JOB_STATES = Object.freeze(["pending", "running", "completed", "failed", "retry_pending"]);

export function retryDelayMs(attemptCount) {
  const attempt = Math.max(1, Number(attemptCount) || 1);
  // 5 min, 10 min, 20 min … capped at six hours. This remains recoverable
  // without creating a tight retry loop during an external outage.
  return Math.min(6 * 60 * 60_000, 5 * 60_000 * (2 ** Math.min(attempt - 1, 7)));
}

export function retryAt(attemptCount, now = Date.now()) {
  return new Date(now + retryDelayMs(attemptCount)).toISOString();
}

export async function ensureJob(db, { type, idempotencyKey, scheduledFor, metadata = null, now = new Date().toISOString() }) {
  const id = crypto.randomUUID();
  await db.prepare("INSERT OR IGNORE INTO automation_jobs(id,job_type,idempotency_key,scheduled_for,status,attempt_count,metadata_json,created_at,updated_at) VALUES(?,?,?,?, 'pending',0,?,?,?)")
    .bind(id, type, idempotencyKey, scheduledFor, metadata ? JSON.stringify(metadata) : null, now, now).run();
  return db.prepare("SELECT * FROM automation_jobs WHERE idempotency_key=?").bind(idempotencyKey).first();
}

export async function recoverExpiredJobs(db, now = new Date().toISOString()) {
  return db.prepare("UPDATE automation_jobs SET status='retry_pending',last_error=COALESCE(last_error,'Execution interrupted before completion'),next_attempt_at=?,lock_token=NULL,lock_expires_at=NULL,updated_at=? WHERE status='running' AND lock_expires_at IS NOT NULL AND lock_expires_at<?")
    .bind(now, now, now).run();
}

export async function claimNextJob(db, type, now = new Date().toISOString(), leaseMs = 12 * 60_000) {
  await recoverExpiredJobs(db, now);
  const row = await db.prepare("SELECT * FROM automation_jobs WHERE job_type=? AND status IN ('pending','retry_pending') AND (next_attempt_at IS NULL OR next_attempt_at<=?) ORDER BY scheduled_for,id LIMIT 1")
    .bind(type, now).first();
  if (!row) return null;
  const token = crypto.randomUUID();
  const expiry = new Date(Date.parse(now) + leaseMs).toISOString();
  const claimed = await db.prepare("UPDATE automation_jobs SET status='running',attempt_count=attempt_count+1,started_at=COALESCE(started_at,?),lock_token=?,lock_expires_at=?,updated_at=? WHERE id=? AND status IN ('pending','retry_pending') AND (next_attempt_at IS NULL OR next_attempt_at<=?)")
    .bind(now, token, expiry, now, row.id, now).run();
  if (Number(claimed.meta?.changes || 0) !== 1) return null;
  return { ...row, status: "running", attempt_count: Number(row.attempt_count || 0) + 1, lock_token: token, lock_expires_at: expiry };
}

/**
 * Claims one known idempotent job.  This is intentionally separate from the
 * normal FIFO claim: controlled validation runs must never steal a real,
 * overdue production job of the same type.
 */
export async function claimJobByIdempotencyKey(db, type, idempotencyKey, now = new Date().toISOString(), leaseMs = 12 * 60_000) {
  await recoverExpiredJobs(db, now);
  const row = await db.prepare("SELECT * FROM automation_jobs WHERE job_type=? AND idempotency_key=? AND status IN ('pending','retry_pending') AND (next_attempt_at IS NULL OR next_attempt_at<=?)")
    .bind(type, idempotencyKey, now).first();
  if (!row) return null;
  const token = crypto.randomUUID();
  const expiry = new Date(Date.parse(now) + leaseMs).toISOString();
  const claimed = await db.prepare("UPDATE automation_jobs SET status='running',attempt_count=attempt_count+1,started_at=COALESCE(started_at,?),lock_token=?,lock_expires_at=?,updated_at=? WHERE id=? AND status IN ('pending','retry_pending') AND (next_attempt_at IS NULL OR next_attempt_at<=?)")
    .bind(now, token, expiry, now, row.id, now).run();
  if (Number(claimed.meta?.changes || 0) !== 1) return null;
  return { ...row, status: "running", attempt_count: Number(row.attempt_count || 0) + 1, lock_token: token, lock_expires_at: expiry };
}

export async function completeJob(db, job, result = null, now = new Date().toISOString()) {
  const update = await db.prepare("UPDATE automation_jobs SET status='completed',finished_at=?,result_json=?,last_error=NULL,next_attempt_at=NULL,lock_token=NULL,lock_expires_at=NULL,updated_at=? WHERE id=? AND status='running' AND lock_token=?")
    .bind(now, result ? JSON.stringify(result) : null, now, job.id, job.lock_token).run();
  return Number(update.meta?.changes || 0) === 1;
}

export async function retryJob(db, job, error, now = new Date().toISOString()) {
  const attempt = Number(job.attempt_count || 1);
  const next = retryAt(attempt, Date.parse(now));
  const update = await db.prepare("UPDATE automation_jobs SET status='retry_pending',last_error=?,next_attempt_at=?,lock_token=NULL,lock_expires_at=NULL,updated_at=? WHERE id=? AND status='running' AND lock_token=?")
    .bind(String(error || "Unknown error").slice(0, 1200), next, now, job.id, job.lock_token).run();
  return Number(update.meta?.changes || 0) === 1 ? next : null;
}

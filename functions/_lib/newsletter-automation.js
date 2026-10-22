import { claimNextJob, completeJob, ensureJob, retryJob } from "../../automation/shared/job-core.js";
import { NEWSLETTER_DELIVERY_HOUR, newsletterClock, newsletterLocalDateTimeToUtc, sundayCycle } from "./newsletter-core.js";
import { runWeeklyNewsletter } from "./newsletter-service.js";

const isoDate = date => date.toISOString().slice(0, 10);

function latestSunday(clock) {
  const noon = new Date(`${clock.date}T12:00:00Z`);
  const offset = noon.getUTCDay();
  noon.setUTCDate(noon.getUTCDate() - offset - (offset === 0 && clock.hour < NEWSLETTER_DELIVERY_HOUR ? 7 : 0));
  return isoDate(noon);
}

/** A scheduler wake-up cannot discard a weekly edition: D1 retains its job. */
export async function runPersistentNewsletter(env, { date = new Date(), dryRun = false } = {}) {
  const timeZone = env.NEWSLETTER_TIMEZONE || "Africa/Casablanca";
  const clock = newsletterClock(date, timeZone);
  const localDate = latestSunday(clock);
  await ensureJob(env.DB, { type: "weekly_newsletter", idempotencyKey: `newsletter:${localDate}`, scheduledFor: newsletterLocalDateTimeToUtc(localDate, NEWSLETTER_DELIVERY_HOUR, 0, timeZone).toISOString(), metadata: { localDate, timeZone } });
  const job = await claimNextJob(env.DB, "weekly_newsletter");
  if (!job) return { skipped: "job_locked_or_waiting", localDate };
  try {
    const localCycle = job.metadata_json ? JSON.parse(job.metadata_json).localDate : localDate;
    const result = await runWeeklyNewsletter(env, { date: new Date(`${localCycle}T12:00:00.000Z`), force: true, dryRun });
    // A repeated wake-up after a successful send must settle the durable job,
    // not turn an already-SENT edition into an endless retry.
    if (result.skipped === "locked_or_sent") {
      const cycleKey = sundayCycle(new Date(`${localCycle}T12:00:00.000Z`), timeZone).cycleKey;
      const cycle = await env.DB.prepare("SELECT status FROM newsletter_runs WHERE cycle_key=?").bind(cycleKey).first();
      if (["SENT", "NO_CONTENT"].includes(cycle?.status)) {
        const settled = { status: cycle.status, alreadyCompleted: true, cycleKey };
        await completeJob(env.DB, job, settled);
        return { ...settled, completedJob: job.id };
      }
    }
    if (["SENT", "NO_CONTENT", "READY"].includes(result.status)) {
      await completeJob(env.DB, job, result);
      return { ...result, completedJob: job.id };
    }
    await retryJob(env.DB, job, `NEWSLETTER_${result.status || "INCOMPLETE"}`);
    return { ...result, retryPending: job.id };
  } catch (error) {
    await retryJob(env.DB, job, String(error?.message || error));
    throw error;
  }
}

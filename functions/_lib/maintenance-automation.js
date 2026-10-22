import { claimJobByIdempotencyKey, claimNextJob, completeJob, ensureJob, retryJob } from "../../automation/shared/job-core.js";
import { NEWSLETTER_TIME_ZONE, newsletterClock, newsletterLocalDateTimeToUtc } from "./newsletter-core.js";

export const MAINTENANCE_TIME_ZONE=NEWSLETTER_TIME_ZONE;
export const MAINTENANCE_HOUR=6;

const isoDate=date=>date.toISOString().slice(0,10);

export function latestMaintenanceSunday(clock){
  const noon=new Date(`${clock.date}T12:00:00Z`);
  const day=noon.getUTCDay();
  noon.setUTCDate(noon.getUTCDate()-day-(day===0&&clock.hour<MAINTENANCE_HOUR?7:0));
  return isoDate(noon);
}

/** A GitHub runner only wakes this durable D1 job; it never defines completion. */
export async function claimPersistentMaintenance(env,{date=new Date(),forceValidation=false}={}){
  const timeZone=env.MAINTENANCE_TIMEZONE||MAINTENANCE_TIME_ZONE;
  const clock=newsletterClock(date,timeZone);
  const localDate=latestMaintenanceSunday(clock);
  const idempotencyKey=forceValidation
    ? `maintenance-validation:${clock.date}`
    : `maintenance:${localDate}`;
  const scheduledFor=forceValidation ? date.toISOString() : newsletterLocalDateTimeToUtc(localDate,MAINTENANCE_HOUR,0,timeZone).toISOString();
  await ensureJob(env.DB,{type:"weekly_maintenance",idempotencyKey,scheduledFor,metadata:{localDate:forceValidation?clock.date:localDate,timeZone,validation:forceValidation}});
  const job=forceValidation
    ? await claimJobByIdempotencyKey(env.DB,"weekly_maintenance",idempotencyKey)
    : await claimNextJob(env.DB,"weekly_maintenance");
  return {localDate:forceValidation?clock.date:localDate,job,validation:forceValidation};
}

export async function settlePersistentMaintenance(env,{jobId,lockToken,ok,result,error}){
  if(!jobId||!lockToken)throw new Error("MAINTENANCE_JOB_PROOF_REQUIRED");
  const job=await env.DB.prepare("SELECT * FROM automation_jobs WHERE id=? AND job_type='weekly_maintenance'").bind(jobId).first();
  if(!job||job.status!=="running"||job.lock_token!==lockToken)throw new Error("MAINTENANCE_JOB_NOT_CLAIMED");
  if(ok){
    const completed=await completeJob(env.DB,job,result||{});
    if(!completed)throw new Error("MAINTENANCE_JOB_COMPLETE_CONFLICT");
    return {status:"completed"};
  }
  const nextAttemptAt=await retryJob(env.DB,job,error||"MAINTENANCE_INCOMPLETE");
  if(!nextAttemptAt)throw new Error("MAINTENANCE_JOB_RETRY_CONFLICT");
  return {status:"retry_pending",nextAttemptAt};
}

export async function maintenanceAutomationStatus(db,{excludeJobId=""}={}){
  const result=await db.prepare("SELECT job_type,status,COUNT(*) AS count,MAX(updated_at) AS updated_at FROM automation_jobs WHERE job_type IN ('editorial_publication','weekly_newsletter','weekly_maintenance') AND (?='' OR id<>?) GROUP BY job_type,status ORDER BY job_type,status").bind(excludeJobId,excludeJobId).all();
  return result.results||[];
}

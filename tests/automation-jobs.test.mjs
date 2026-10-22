import test from "node:test";
import assert from "node:assert/strict";
import { JOB_STATES, claimJobByIdempotencyKey, retryAt, retryDelayMs } from "../automation/shared/job-core.js";
import { latestMaintenanceSunday, MAINTENANCE_HOUR } from "../functions/_lib/maintenance-automation.js";

test("uses the five durable states required by TAMUSNI", () => {
  assert.deepEqual(JOB_STATES, ["pending", "running", "completed", "failed", "retry_pending"]);
});

test("backs off retries without losing the original job", () => {
  assert.equal(retryDelayMs(1), 5 * 60_000);
  assert.equal(retryDelayMs(2), 10 * 60_000);
  assert.equal(retryDelayMs(99), 6 * 60 * 60_000);
  assert.equal(retryAt(2, Date.UTC(2026, 9, 22, 6, 0)), "2026-10-22T06:10:00.000Z");
});

test("maintenance keeps the previous Sunday due until the 06:00 Casablanca slot",()=>{
  assert.equal(MAINTENANCE_HOUR,6);
  assert.equal(latestMaintenanceSunday({date:"2026-10-25",hour:5}),"2026-10-18");
  assert.equal(latestMaintenanceSunday({date:"2026-10-25",hour:6}),"2026-10-25");
});

test("exports an isolated idempotent claim primitive for controlled validation",()=>{
  assert.equal(typeof claimJobByIdempotencyKey,"function");
});

import test from "node:test";
import assert from "node:assert/strict";
import { consumeOtpChallenge, createOtpChallenge, verifyTurnstile } from "../functions/_lib/account-security.js";

function challengeDatabase() {
  const rows = [];
  const statement = (sql, args = []) => ({
    bind(...values) { return statement(sql, values); },
    async first() {
      if (sql.includes("SELECT sent_at")) { const row = rows.filter(item => item.user_id === args[0] && item.purpose === args[1]).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]; return row ? { ...row } : null; }
      if (sql.includes("SELECT id,code_hash")) { const row = rows.filter(item => item.user_id === args[0] && item.purpose === args[1]).sort((a, b) => b.created_at.localeCompare(a.created_at))[0]; return row ? { ...row } : null; }
      return null;
    },
    async run() {
      if (sql.startsWith("DELETE FROM account_challenges")) {
        for (let index = rows.length - 1; index >= 0; index -= 1) if (rows[index].user_id === args[0] && rows[index].purpose === args[1]) rows.splice(index, 1);
      } else if (sql.startsWith("INSERT INTO account_challenges")) {
        rows.push({ id: args[0], user_id: args[1], purpose: args[2], code_hash: args[3], expires_at: args[4], attempts: args[5], max_attempts: args[6], consumed_at: null, created_at: args[7], sent_at: args[8] });
      } else if (sql.includes("SET attempts=attempts+1")) {
        const row = rows.find(item => item.id === args[0]);
        if (row && !row.consumed_at) row.attempts += 1;
      } else if (sql.includes("SET consumed_at")) {
        const row = rows.find(item => item.id === args[1]);
        if (!row || row.consumed_at || row.attempts >= row.max_attempts) return { meta: { changes: 0 } };
        row.consumed_at = args[0];
        return { meta: { changes: 1 } };
      }
      return { meta: { changes: 1 } };
    }
  });
  return { rows, prepare: sql => statement(sql), async batch(statements) { for (const item of statements) await item.run(); } };
}

test("account OTP stores only a hash and can be consumed once", async () => {
  const DB = challengeDatabase();
  const context = { env: { DB, SESSION_SECRET: "test-session-secret" } };
  const challenge = await createOtpChallenge(context, "user-1", "EMAIL_VERIFICATION");
  assert.match(challenge.code, /^\d{6}$/);
  assert.equal(DB.rows[0].code_hash.includes(challenge.code), false);
  assert.equal((await consumeOtpChallenge(context, "user-1", "EMAIL_VERIFICATION", challenge.code)).ok, true);
  assert.equal((await consumeOtpChallenge(context, "user-1", "EMAIL_VERIFICATION", challenge.code)).ok, false);
});

test("account OTP locks after five invalid attempts", async () => {
  const DB = challengeDatabase();
  const context = { env: { DB, SESSION_SECRET: "test-session-secret" } };
  await createOtpChallenge(context, "user-2", "ACCOUNT_DELETION");
  for (let attempt = 1; attempt <= 4; attempt += 1) assert.equal((await consumeOtpChallenge(context, "user-2", "ACCOUNT_DELETION", "000000")).reason, "invalid");
  assert.equal((await consumeOtpChallenge(context, "user-2", "ACCOUNT_DELETION", "000000")).reason, "locked");
  assert.equal((await consumeOtpChallenge(context, "user-2", "ACCOUNT_DELETION", "000000")).reason, "locked");
});

test("Turnstile validation is performed server-side", async () => {
  const originalFetch = globalThis.fetch;
  let submitted;
  globalThis.fetch = async (_url, options) => { submitted = options.body; return Response.json({ success: true }); };
  try {
    const request = new Request("https://tamusni.test/api/auth/register", { headers: { "CF-Connecting-IP": "203.0.113.5" } });
    const result = await verifyTurnstile({ request, env: { TURNSTILE_SECRET_KEY: "secret" } }, "browser-token");
    assert.equal(result.success, true);
    assert.equal(submitted.get("secret"), "secret");
    assert.equal(submitted.get("response"), "browser-token");
    assert.equal(submitted.get("remoteip"), "203.0.113.5");
  } finally { globalThis.fetch = originalFetch; }
});

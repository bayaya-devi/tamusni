import { hashToken } from "./auth.js";

const OTP_TTL_MS = 10 * 60_000;
const OTP_RESEND_MS = 60_000;
const OTP_MAX_ATTEMPTS = 5;

const limits = {
  login: { maximum: 12, windowMs: 15 * 60_000 },
  register: { maximum: 5, windowMs: 60 * 60_000 },
  forgot_password: { maximum: 5, windowMs: 60 * 60_000 },
  reset_password: { maximum: 8, windowMs: 30 * 60_000 },
  verify_email: { maximum: 12, windowMs: 15 * 60_000 },
  resend_verification: { maximum: 5, windowMs: 60 * 60_000 },
  delete_account: { maximum: 6, windowMs: 30 * 60_000 },
  newsletter: { maximum: 10, windowMs: 60 * 60_000 }
};

const ipAddress = request => request.headers.get("CF-Connecting-IP") || "unknown";

/** Consume one request from both the IP and account/e-mail security buckets. */
export async function consumeRateLimit(context, action, identity = "anonymous") {
  const policy = limits[action] || { maximum: 10, windowMs: 15 * 60_000 };
  const now = Date.now();
  const subjects = [`ip:${ipAddress(context.request)}`, `identity:${String(identity).trim().toLowerCase() || "anonymous"}`];
  let retryAfter = 0;
  for (const subject of subjects) {
    const bucketHash = await hashToken(`${action}|${subject}`);
    const nowIso = new Date(now).toISOString();
    const windowCutoff = new Date(now - policy.windowMs).toISOString();
    await context.env.DB.prepare("INSERT INTO security_rate_limits(bucket_hash,action,attempts,window_started_at,blocked_until,updated_at) VALUES(?,?,1,?,NULL,?) ON CONFLICT(bucket_hash) DO UPDATE SET action=excluded.action,attempts=CASE WHEN security_rate_limits.blocked_until>? THEN security_rate_limits.attempts WHEN security_rate_limits.window_started_at>=? THEN security_rate_limits.attempts+1 ELSE 1 END,window_started_at=CASE WHEN (security_rate_limits.blocked_until IS NULL OR security_rate_limits.blocked_until<=?) AND security_rate_limits.window_started_at<? THEN excluded.window_started_at ELSE security_rate_limits.window_started_at END,updated_at=excluded.updated_at").bind(bucketHash, action, nowIso, nowIso, nowIso, windowCutoff, nowIso, windowCutoff).run();
    const row = await context.env.DB.prepare("SELECT attempts,window_started_at,blocked_until FROM security_rate_limits WHERE bucket_hash=?").bind(bucketHash).first();
    if (row?.blocked_until && Date.parse(row.blocked_until) > now) {
      retryAfter = Math.max(retryAfter, Math.ceil((Date.parse(row.blocked_until) - now) / 1000));
      continue;
    }
    const attempts = Number(row?.attempts || 1);
    const excess = Math.max(0, attempts - policy.maximum);
    const blockMs = excess ? Math.min(policy.windowMs * 4, policy.windowMs * (2 ** Math.min(excess - 1, 2))) : 0;
    const blockedUntil = blockMs ? new Date(now + blockMs).toISOString() : null;
    if (blockedUntil) await context.env.DB.prepare("UPDATE security_rate_limits SET blocked_until=?,updated_at=? WHERE bucket_hash=?").bind(blockedUntil, nowIso, bucketHash).run();
    if (blockedUntil) retryAfter = Math.max(retryAfter, Math.ceil(blockMs / 1000));
  }
  return { allowed: retryAfter === 0, retryAfter };
}

export function rateLimitResponse(result) {
  return Response.json({ error: "Trop de tentatives. Réessayez plus tard." }, { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": String(Math.max(1, result.retryAfter || 60)) } });
}

/** Validate Cloudflare Turnstile whenever the production secret is configured. */
export async function verifyTurnstile(context, token) {
  if (!context.env.TURNSTILE_SECRET_KEY) return { success: context.env.TURNSTILE_REQUIRED !== "true", unavailable: true };
  if (!token) return { success: false, missing: true };
  try {
    const form = new FormData();
    form.set("secret", context.env.TURNSTILE_SECRET_KEY);
    form.set("response", String(token));
    const remoteIp = ipAddress(context.request);
    if (remoteIp !== "unknown") form.set("remoteip", remoteIp);
    const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
    if (!response.ok) return { success: false, unavailable: true };
    const result = await response.json();
    return { success: result.success === true, codes: result["error-codes"] || [] };
  } catch (error) {
    console.error("turnstile_validation_failed", error);
    return { success: false, unavailable: true };
  }
}

export function turnstileError(result) {
  return result.unavailable ? "La vérification anti-abus est momentanément indisponible." : "Confirmez que vous n’êtes pas un robot.";
}

const randomCode = () => {
  const values = crypto.getRandomValues(new Uint32Array(1));
  return String(values[0] % 1_000_000).padStart(6, "0");
};

const challengeHash = (context, id, purpose, code) => hashToken(`${id}:${purpose}:${code}:${context.env.SESSION_SECRET}`);

/** Replace any prior challenge and return the one-time clear code for immediate e-mail delivery. */
export async function createOtpChallenge(context, userId, purpose) {
  if (!context.env.SESSION_SECRET) throw new Error("SESSION_SECRET_MISSING");
  const latest = await context.env.DB.prepare("SELECT sent_at FROM account_challenges WHERE user_id=? AND purpose=? ORDER BY created_at DESC LIMIT 1").bind(userId, purpose).first();
  if (latest && Date.now() - Date.parse(latest.sent_at) < OTP_RESEND_MS) {
    const error = new Error("OTP_COOLDOWN");
    error.retryAfter = Math.ceil((OTP_RESEND_MS - (Date.now() - Date.parse(latest.sent_at))) / 1000);
    throw error;
  }
  const id = crypto.randomUUID();
  const code = randomCode();
  const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare("DELETE FROM account_challenges WHERE user_id=? AND purpose=?").bind(userId, purpose),
    context.env.DB.prepare("INSERT INTO account_challenges(id,user_id,purpose,code_hash,expires_at,attempts,max_attempts,created_at,sent_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(id, userId, purpose, await challengeHash(context, id, purpose, code), new Date(Date.now() + OTP_TTL_MS).toISOString(), 0, OTP_MAX_ATTEMPTS, now, now)
  ]);
  return { id, code, expiresIn: OTP_TTL_MS / 1000 };
}

/** Atomically consumes a valid OTP. Invalid attempts are counted and capped at five. */
export async function consumeOtpChallenge(context, userId, purpose, code) {
  const supplied = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(supplied)) return { ok: false, reason: "invalid" };
  const row = await context.env.DB.prepare("SELECT id,code_hash,expires_at,attempts,max_attempts,consumed_at FROM account_challenges WHERE user_id=? AND purpose=? ORDER BY created_at DESC LIMIT 1").bind(userId, purpose).first();
  if (!row || row.consumed_at || Date.parse(row.expires_at) <= Date.now()) return { ok: false, reason: "expired" };
  if (Number(row.attempts) >= Number(row.max_attempts)) return { ok: false, reason: "locked" };
  const claimedAttempt = await context.env.DB.prepare("UPDATE account_challenges SET attempts=attempts+1 WHERE id=? AND consumed_at IS NULL AND attempts<max_attempts AND expires_at>?").bind(row.id, new Date().toISOString()).run();
  if (Number(claimedAttempt?.meta?.changes || 0) !== 1) return { ok: false, reason: "locked" };
  const actualHash = await challengeHash(context, row.id, purpose, supplied);
  if (actualHash !== row.code_hash) {
    return { ok: false, reason: Number(row.attempts) + 1 >= Number(row.max_attempts) ? "locked" : "invalid", remaining: Math.max(0, Number(row.max_attempts) - Number(row.attempts) - 1) };
  }
  const consumedAt = new Date().toISOString();
  const result = await context.env.DB.prepare("UPDATE account_challenges SET consumed_at=? WHERE id=? AND consumed_at IS NULL AND attempts<=max_attempts").bind(consumedAt, row.id).run();
  return { ok: Number(result?.meta?.changes ?? 1) > 0, reason: "consumed" };
}

export function browserLabel(userAgent = "") {
  const value = String(userAgent);
  if (/Edg\//.test(value)) return "Microsoft Edge";
  if (/Firefox\//.test(value)) return "Firefox";
  if (/Chrome\//.test(value)) return "Google Chrome";
  if (/Safari\//.test(value)) return "Safari";
  return "Navigateur inconnu";
}

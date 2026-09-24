import { createMfaChallengeCookie, createSessionCookie, hashPassword, hashToken, json, readBody, sameOrigin, validEmail, verifyPassword } from "../../_lib/auth.js";
import { mirrorUser } from "../../_lib/supabase.js";
import { recordAuthEvent } from "../../_lib/mfa.js";

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  try {
    const body = await readBody(context.request); const email = String(body.email || "").trim().toLowerCase(); const password = String(body.password || "");
    if (!validEmail(email) || password.length < 6) return json({ error: "Identifiants invalides." }, 401);
    const now = Date.now();
    const attemptKey = await hashToken(`${context.request.headers.get("CF-Connecting-IP") || "unknown"}|${email}`);
    const attempt = await context.env.DB.prepare("SELECT attempts, window_started_at, blocked_until FROM login_attempts WHERE key_hash = ?").bind(attemptKey).first();
    if (attempt?.blocked_until && Date.parse(attempt.blocked_until) > now) return json({ error: "Trop de tentatives. Réessayez dans quelques minutes." }, 429, { "Retry-After": "900" });
    const user = await context.env.DB.prepare("SELECT id, name, email, password_hash, role, mfa_enabled FROM users WHERE email = ?").bind(email).first();
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      const withinWindow = attempt?.window_started_at && now - Date.parse(attempt.window_started_at) < 900_000;
      const attempts = withinWindow ? Number(attempt.attempts || 0) + 1 : 1;
      const blockedUntil = attempts >= 5 ? new Date(now + 900_000).toISOString() : null;
      await context.env.DB.prepare("INSERT INTO login_attempts(key_hash,attempts,window_started_at,blocked_until) VALUES(?,?,?,?) ON CONFLICT(key_hash) DO UPDATE SET attempts=excluded.attempts,window_started_at=excluded.window_started_at,blocked_until=excluded.blocked_until").bind(attemptKey, attempts, withinWindow ? attempt.window_started_at : new Date(now).toISOString(), blockedUntil).run();
      try { await recordAuthEvent(context,{ userId:user?.id||null, email, event:"password_failure" }); } catch {}
      return json({ error: "Identifiants invalides." }, 401);
    }
    await context.env.DB.prepare("DELETE FROM login_attempts WHERE key_hash = ?").bind(attemptKey).run();
    if(Number(String(user.password_hash).split("$")[1]||0)<600_000)await context.env.DB.prepare("UPDATE users SET password_hash=? WHERE id=?").bind(await hashPassword(password),user.id).run();
    try { await mirrorUser(context.env, user); } catch (error) { console.error("supabase_user_mirror_failed", error); }
    if (!context.env.SESSION_SECRET) return json({ error: "Configuration de session indisponible." }, 503);
    if (user.mfa_enabled) return json({ ok: true, mfaRequired: true, message: "Saisissez le code de votre application d’authentification." }, 202, { "Set-Cookie": await createMfaChallengeCookie(user, context.env.SESSION_SECRET) });
    try { await recordAuthEvent(context,{ userId:user.id, email:user.email, event:"login_success" }); } catch {}
    return json({ ok: true, redirect: user.role === "ADMIN" ? "/admin" : "/" }, 200, { "Set-Cookie": await createSessionCookie(user, context.env.SESSION_SECRET) });
  } catch { return json({ error: "Connexion impossible pour le moment." }, 500); }
}

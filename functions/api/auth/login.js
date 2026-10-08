import { createMfaChallengeCookie, createSessionCookie, hashToken, json, readBody, sameOrigin, validEmail, verifyPassword } from "../../_lib/auth.js";
import { mirrorUser } from "../../_lib/supabase.js";
import { recordAuthEvent } from "../../_lib/mfa.js";
import { finalizeNewsletterIntent } from "../../_lib/newsletter-service.js";

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  try {
    const body = await readBody(context.request); const email = String(body.email || "").trim().toLowerCase(); const password = String(body.password || "");
    if (!validEmail(email) || password.length < 6) return json({ error: "Identifiants invalides." }, 401);
    const now = Date.now();
    const attemptKey = await hashToken(`${context.request.headers.get("CF-Connecting-IP") || "unknown"}|${email}`);
    const attempt = await context.env.DB.prepare("SELECT attempts, window_started_at, blocked_until FROM login_attempts WHERE key_hash = ?").bind(attemptKey).first();
    if (attempt?.blocked_until && Date.parse(attempt.blocked_until) > now) return json({ error: "Trop de tentatives. Réessayez dans quelques minutes." }, 429, { "Retry-After": "900" });
    const user = await context.env.DB.prepare("SELECT u.id,u.name,u.email,u.password_hash,u.role,u.mfa_enabled,u.is_banned,u.email_verified_at,r.role AS additional_role FROM users u LEFT JOIN user_roles r ON r.user_id=u.id WHERE u.email = ?").bind(email).first();
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      const withinWindow = attempt?.window_started_at && now - Date.parse(attempt.window_started_at) < 900_000;
      const attempts = withinWindow ? Number(attempt.attempts || 0) + 1 : 1;
      const blockedUntil = attempts >= 5 ? new Date(now + 900_000).toISOString() : null;
      await context.env.DB.prepare("INSERT INTO login_attempts(key_hash,attempts,window_started_at,blocked_until) VALUES(?,?,?,?) ON CONFLICT(key_hash) DO UPDATE SET attempts=excluded.attempts,window_started_at=excluded.window_started_at,blocked_until=excluded.blocked_until").bind(attemptKey, attempts, withinWindow ? attempt.window_started_at : new Date(now).toISOString(), blockedUntil).run();
      try { await recordAuthEvent(context,{ userId:user?.id||null, email, event:"password_failure" }); } catch {}
      return json({ error: "Identifiants invalides." }, 401);
    }
    if (user.is_banned) return json({ error: "Ce compte est suspendu. Contactez TAMUSNI si vous pensez qu’il s’agit d’une erreur." }, 403);
    if (!user.email_verified_at) return json({ error:"Confirmez votre adresse e-mail avant de vous connecter.", code:"EMAIL_NOT_VERIFIED", verificationRequired:true }, 403);
    await context.env.DB.prepare("DELETE FROM login_attempts WHERE key_hash = ?").bind(attemptKey).run();
    try { await mirrorUser(context.env, user); } catch (error) { console.error("supabase_user_mirror_failed", error); }
    if (!context.env.SESSION_SECRET) return json({ error: "Configuration de session indisponible." }, 503);
    if (user.mfa_enabled) return json({ ok: true, mfaRequired: true, message: "Saisissez le code de votre application d’authentification." }, 202, { "Set-Cookie": await createMfaChallengeCookie(user, context.env.SESSION_SECRET) });
    try { await recordAuthEvent(context,{ userId:user.id, email:user.email, event:"login_success" }); } catch {}
    const role = user.role === "ADMIN" ? "ADMIN" : user.additional_role || "USER";let newsletter=null;try{newsletter=await finalizeNewsletterIntent(context,user)}catch(error){console.error("newsletter_intent_finalize_failed",error)}
    return json({ ok: true, newsletter:newsletter&&!newsletter.mismatch?"subscribed":newsletter?.mismatch?"email_mismatch":null,redirect: role === "ADMIN" ? "/admin/" : role === "CONTRIBUTOR" ? "/contributeur/" : `/mon-espace/${newsletter&&!newsletter.mismatch?'?newsletter=success':''}` }, 200, { "Set-Cookie": await createSessionCookie({ ...user, role }, context.env.SESSION_SECRET) });
  } catch(error) { console.error("login_failed",error); return json({ error: "Connexion impossible pour le moment." }, 500); }
}

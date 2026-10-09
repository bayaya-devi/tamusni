import { clearSessionCookie, hashPassword, hashToken, json, readBody, sameOrigin } from "../../_lib/auth.js";
import { consumeRateLimit, rateLimitResponse } from "../../_lib/account-security.js";
import { sendSecurityEmail } from "../../_lib/security-email.js";

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  try {
    const body = await readBody(context.request);
    const token = String(body.token || "");
    const password = String(body.password || "");
    const confirmation = String(body.passwordConfirmation || "");
    const locale = ["fr", "ar", "en", "es", "pt"].includes(body.locale) ? body.locale : "fr";
    const limit = await consumeRateLimit(context, "reset_password", token.slice(0, 24) || "missing");
    if (!limit.allowed) return rateLimitResponse(limit);
    if (token.length < 20 || password.length < 12 || password.length > 128 || password !== confirmation) return json({ error: "Lien invalide ou mot de passe non conforme (12 caractères minimum)." }, 400);
    const tokenHash = await hashToken(token);
    const found = await context.env.DB.prepare("SELECT p.user_id,u.name,u.email,u.preferred_language FROM password_reset_tokens p JOIN users u ON u.id=p.user_id WHERE p.token_hash=? AND p.expires_at>? LIMIT 1").bind(tokenHash, new Date().toISOString()).first();
    if (!found) return json({ error: "Ce lien est invalide ou expiré." }, 400);
    const claimed = await context.env.DB.prepare("DELETE FROM password_reset_tokens WHERE token_hash=? AND expires_at>?").bind(tokenHash, new Date().toISOString()).run();
    if (Number(claimed?.meta?.changes || 0) !== 1) return json({ error: "Ce lien est invalide ou a déjà été utilisé." }, 400);
    await context.env.DB.batch([
      context.env.DB.prepare("UPDATE users SET password_hash=?,session_version=session_version+1 WHERE id=?").bind(await hashPassword(password), found.user_id),
      context.env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id=?").bind(found.user_id)
    ]);
    try { await sendSecurityEmail(context.env, { type: "changed", to: found.email, name: found.name, locale: found.preferred_language || locale }); } catch (error) { console.error("password_changed_email_failed", error); }
    return json({ ok: true, redirect: `/${locale}/connexion/?password=changed` }, 200, { "Set-Cookie": clearSessionCookie() });
  } catch (error) {
    console.error("reset_password_failed", error);
    return json({ error: "Réinitialisation impossible." }, 500);
  }
}

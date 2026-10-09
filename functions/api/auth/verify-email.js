import { hashToken, json, readBody, sameOrigin, validEmail } from "../../_lib/auth.js";
import { consumeOtpChallenge, consumeRateLimit, rateLimitResponse } from "../../_lib/account-security.js";
import { finalizeNewsletterIntent } from "../../_lib/newsletter-service.js";

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  try {
    const body = await readBody(context.request);
    const email = String(body.email || "").trim().toLowerCase();
    if (!validEmail(email)) return json({ error: "Code invalide ou expiré." }, 400);
    const limit = await consumeRateLimit(context, "verify_email", email);
    if (!limit.allowed) return rateLimitResponse(limit);
    const user = await context.env.DB.prepare("SELECT id,name,email,email_verified_at,preferred_language FROM users WHERE email=?").bind(email).first();
    if (!user) return json({ error: "Code invalide ou expiré." }, 400);
    if (user.email_verified_at) return json({ ok: true, redirect: `/${user.preferred_language || "fr"}/connexion/?verification=success` });
    const result = await consumeOtpChallenge(context, user.id, "EMAIL_VERIFICATION", body.code);
    if (!result.ok) return json({ error: result.reason === "locked" ? "Trop de codes incorrects. Demandez un nouveau code." : "Code invalide ou expiré.", remaining: result.remaining }, 400);
    const now = new Date().toISOString();
    await context.env.DB.prepare("UPDATE users SET email_verified_at=? WHERE id=? AND email_verified_at IS NULL").bind(now, user.id).run();
    let newsletter = null;
    try { newsletter = await finalizeNewsletterIntent(context, { ...user, sub: user.id }); } catch (error) { console.error("newsletter_intent_finalize_failed", error); }
    const locale = ["fr", "ar", "en", "es", "pt"].includes(body.locale) ? body.locale : user.preferred_language || "fr";
    return json({ ok: true, newsletter: newsletter && !newsletter.mismatch ? "subscribed" : null, redirect: `/${locale}/connexion/?verification=success` });
  } catch (error) {
    console.error("verify_email_failed", error);
    return json({ error: "Vérification impossible pour le moment." }, 500);
  }
}

// Backward compatibility for confirmation links already sent before the OTP migration.
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const token = String(url.searchParams.get("token") || "");
  const locale = ["fr", "ar", "en", "es", "pt"].includes(url.searchParams.get("locale")) ? url.searchParams.get("locale") : "fr";
  const redirect = new URL(`/${locale}/connexion/?verification=invalid`, url.origin);
  if (!token) return Response.redirect(redirect, 302);
  try {
    const row = await context.env.DB.prepare("SELECT user_id,expires_at FROM email_verification_tokens WHERE token_hash=?").bind(await hashToken(token)).first();
    if (!row || Date.parse(row.expires_at) < Date.now()) return Response.redirect(redirect, 302);
    await context.env.DB.batch([
      context.env.DB.prepare("UPDATE users SET email_verified_at=COALESCE(email_verified_at,?) WHERE id=?").bind(new Date().toISOString(), row.user_id),
      context.env.DB.prepare("DELETE FROM email_verification_tokens WHERE user_id=?").bind(row.user_id)
    ]);
    return Response.redirect(new URL(`/${locale}/connexion/?verification=success`, url.origin), 302);
  } catch (error) {
    console.error("legacy_verify_email_failed", error);
    return Response.redirect(redirect, 302);
  }
}

import { json, readBody, sameOrigin, validEmail } from "../../_lib/auth.js";
import { consumeRateLimit, createOtpChallenge, rateLimitResponse, turnstileError, verifyTurnstile } from "../../_lib/account-security.js";
import { emailProvider } from "../../_lib/email.js";
import { sendSecurityEmail } from "../../_lib/security-email.js";

const GENERIC_MESSAGE = "Si ce compte existe et reste à confirmer, un nouveau code vient d’être envoyé.";

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  try {
    const body = await readBody(context.request);
    const email = String(body.email || "").trim().toLowerCase();
    const locale = ["fr", "ar", "en", "es", "pt"].includes(body.locale) ? body.locale : "fr";
    if (!validEmail(email)) return json({ ok: true, message: GENERIC_MESSAGE });
    const limit = await consumeRateLimit(context, "resend_verification", email);
    if (!limit.allowed) return rateLimitResponse(limit);
    if (!emailProvider(context.env)) return json({ error: "Le service de confirmation est momentanément indisponible." }, 503);
    const turnstile = await verifyTurnstile(context, body.turnstileToken || body["cf-turnstile-response"]);
    if (!turnstile.success && context.env.TURNSTILE_REQUIRED === "true") return json({ error: turnstileError(turnstile) }, turnstile.unavailable ? 503 : 400);
    const user = await context.env.DB.prepare("SELECT id,name,email_verified_at,preferred_language FROM users WHERE email=?").bind(email).first();
    if (!user || user.email_verified_at) return json({ ok: true, message: GENERIC_MESSAGE });
    try {
      const challenge = await createOtpChallenge(context, user.id, "EMAIL_VERIFICATION");
      await sendSecurityEmail(context.env, { type: "verification", to: email, name: user.name, locale: user.preferred_language || locale, code: challenge.code });
    } catch (error) {
      if (error.message === "OTP_COOLDOWN") return json({ ok: true, message: GENERIC_MESSAGE, retryAfter: error.retryAfter });
      throw error;
    }
    return json({ ok: true, message: GENERIC_MESSAGE });
  } catch (error) {
    console.error("resend_verification_failed", error);
    return json({ error: "Impossible de renvoyer le code pour le moment." }, 500);
  }
}

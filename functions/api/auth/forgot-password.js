import { hashToken, json, readBody, sameOrigin, validEmail } from "../../_lib/auth.js";
import { consumeRateLimit, rateLimitResponse, turnstileError, verifyTurnstile } from "../../_lib/account-security.js";
import { emailProvider } from "../../_lib/email.js";
import { sendSecurityEmail } from "../../_lib/security-email.js";

const MESSAGE = "Si ce compte existe, un e-mail vient d’être envoyé.";

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  if (!emailProvider(context.env)) return json({ error: "Le service d’e-mail est momentanément indisponible." }, 503);
  try {
    const body = await readBody(context.request);
    const email = String(body.email || "").trim().toLowerCase();
    const locale = ["fr", "ar", "en", "es", "pt"].includes(body.locale) ? body.locale : "fr";
    const limit = await consumeRateLimit(context, "forgot_password", validEmail(email) ? email : "invalid");
    if (!limit.allowed) return rateLimitResponse(limit);
    const turnstile = await verifyTurnstile(context, body.turnstileToken || body["cf-turnstile-response"]);
    if (!turnstile.success) return json({ error: turnstileError(turnstile) }, turnstile.unavailable ? 503 : 400);
    if (!validEmail(email)) return json({ ok: true, message: MESSAGE });
    const user = await context.env.DB.prepare("SELECT id,name,email,preferred_language FROM users WHERE email=? LIMIT 1").bind(email).first();
    if (user) {
      const bytes = crypto.getRandomValues(new Uint8Array(32));
      const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
      const now = new Date().toISOString();
      await context.env.DB.batch([
        context.env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id=?").bind(user.id),
        context.env.DB.prepare("INSERT INTO password_reset_tokens(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)").bind(await hashToken(token), user.id, new Date(Date.now() + 30 * 60_000).toISOString(), now)
      ]);
      const language = user.preferred_language || locale;
      const origin = (context.env.PUBLIC_SITE_URL || new URL(context.request.url).origin).replace(/\/$/, "");
      const resetUrl = `${origin}/${language}/reinitialiser-mot-de-passe/?token=${encodeURIComponent(token)}`;
      await sendSecurityEmail(context.env, { type: "reset", to: user.email, name: user.name, locale: language, url: resetUrl });
    }
    return json({ ok: true, message: MESSAGE });
  } catch (error) {
    console.error("forgot_password_failed", error);
    return json({ error: "La demande n’a pas pu être traitée." }, 502);
  }
}

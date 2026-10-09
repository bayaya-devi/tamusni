import { hashPassword, json, readBody, sameOrigin, validEmail } from "../../_lib/auth.js";
import { consumeRateLimit, createOtpChallenge, rateLimitResponse, turnstileError, verifyTurnstile } from "../../_lib/account-security.js";
import { emailProvider } from "../../_lib/email.js";
import { sendSecurityEmail } from "../../_lib/security-email.js";
import { mirrorUser } from "../../_lib/supabase.js";
import { normalizeTopics } from "../../_lib/topics.js";

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  try {
    const body = await readBody(context.request);
    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const name = String(body.name || `${firstName} ${lastName}`).trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const locale = ["fr", "ar", "en", "es", "pt"].includes(body.locale) ? body.locale : "fr";
    const preferredTopics = normalizeTopics(body.preferredTopics, body.preferredTopic);
    const termsAccepted = body.termsAccepted === "on" || body.termsAccepted === true;
    const sponsoredInApp = body.sponsoredInApp === "on" || body.sponsoredInApp === true ? 1 : 0;
    const sponsoredEmail = body.sponsoredEmail === "on" || body.sponsoredEmail === true ? 1 : 0;
    if (name.length < 2 || !validEmail(email) || password.length < 12 || password.length > 128 || !preferredTopics.length || !termsAccepted) return json({ error: "Renseignez vos informations, utilisez un mot de passe d’au moins 12 caractères, choisissez une rubrique et acceptez les conditions." }, 400);
    if (!emailProvider(context.env)) return json({ error: "La création de compte est momentanément indisponible : le service d’e-mail n’est pas activé." }, 503);
    if (!context.env.SESSION_SECRET) return json({ error: "Configuration de sécurité indisponible." }, 503);
    const limit = await consumeRateLimit(context, "register", email);
    if (!limit.allowed) return rateLimitResponse(limit);
    const turnstile = await verifyTurnstile(context, body.turnstileToken || body["cf-turnstile-response"]);
    if (!turnstile.success) return json({ error: turnstileError(turnstile) }, turnstile.unavailable ? 503 : 400);
    const existing = await context.env.DB.prepare("SELECT id,email_verified_at FROM users WHERE email=?").bind(email).first();
    if (existing) return json({ error: existing.email_verified_at ? "Un compte existe déjà avec cette adresse." : "Ce compte attend déjà sa confirmation. Demandez un nouveau code." }, 409);

    const now = new Date().toISOString();
    const preferredTopic = preferredTopics[0];
    const user = { id: crypto.randomUUID(), name, email, role: "USER", preferredTopic, termsAcceptedAt: now, sponsoredInApp, sponsoredEmail, created_at: now, session_version: 1 };
    await context.env.DB.batch([
      context.env.DB.prepare("INSERT INTO users (id,name,email,password_hash,role,created_at,preferred_language,preferred_topic,terms_accepted_at,sponsored_in_app,sponsored_email,session_version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)").bind(user.id, name, email, await hashPassword(password), "USER", now, locale, preferredTopic, now, sponsoredInApp, sponsoredEmail, 1),
      ...preferredTopics.map(topic => context.env.DB.prepare("INSERT INTO topic_subscriptions(user_id,topic,created_at) VALUES(?,?,?)").bind(user.id, topic, now))
    ]);

    const challenge = await createOtpChallenge(context, user.id, "EMAIL_VERIFICATION");
    let emailSent = true;
    try {
      await sendSecurityEmail(context.env, { type: "verification", to: email, name, locale, code: challenge.code });
    } catch (error) {
      emailSent = false;
      console.error("registration_verification_email_failed", error);
    }
    try { await context.env.DB.prepare("INSERT INTO admin_notifications(id,type,title,body,target_url,target_type,target_id,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "account", "Nouveau compte", "Un compte non vérifié vient d’être créé.", "/admin/#accounts", "user", user.id, now).run(); } catch (error) { console.error("admin_notification_failed", error); }
    try { await mirrorUser(context.env, user); } catch (error) { console.error("supabase_user_mirror_failed", error); }
    return json({ ok: true, verificationRequired: true, emailSent, redirect: `/${locale}/verifier-email/?email=${encodeURIComponent(email)}`, message: emailSent ? "Compte créé. Saisissez le code reçu par e-mail." : "Compte créé, mais l’e-mail n’a pas pu être envoyé. Demandez un nouveau code." }, 201);
  } catch (error) {
    console.error("registration_failed", error);
    return json({ error: error?.message === "PAYLOAD_TOO_LARGE" ? "Requête trop volumineuse." : "Création du compte impossible." }, error?.message === "PAYLOAD_TOO_LARGE" ? 413 : 500);
  }
}

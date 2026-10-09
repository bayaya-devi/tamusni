import { cleanText, clearSessionCookie, createSessionCookie, hashPassword, json, readBody, requireSession, sameOrigin, validEmail, verifyPassword } from "../_lib/auth.js";
import { consumeOtpChallenge, consumeRateLimit, createOtpChallenge, rateLimitResponse } from "../_lib/account-security.js";
import { sendSecurityEmail } from "../_lib/security-email.js";
import { removeMirroredUser } from "../_lib/supabase.js";
import { normalizeTopics, replaceTopicSubscriptions } from "../_lib/topics.js";

const languages = new Set(["fr", "en", "ar", "es", "pt"]);
const themes = new Set(["auto", "light", "dark"]);
const textSizes = new Set(["small", "normal", "large"]);
const densities = new Set(["compact", "comfortable"]);

export async function onRequestGet(context) {
  const session = await requireSession(context);
  if (!session) return json({ error: "Connexion requise." }, 401);
  const [profile, history, topics, searches, notifications] = await Promise.all([
    context.env.DB.prepare("SELECT u.id,u.name,u.email,CASE WHEN u.role='ADMIN' THEN 'ADMIN' WHEN r.role='CONTRIBUTOR' THEN 'CONTRIBUTOR' ELSE 'USER' END AS role,u.avatar_url,u.bio,u.preferred_language,u.preferred_theme,u.text_size,u.display_density,u.notifications_enabled,u.preferred_topic,u.sponsored_in_app,u.sponsored_email,u.created_at FROM users u LEFT JOIN user_roles r ON r.user_id=u.id WHERE u.id=?").bind(session.sub).first(),
    context.env.DB.prepare("SELECT c.slug,c.type,c.title,c.category,h.progress,h.last_read_at FROM reading_history h JOIN content_items c ON c.id=h.content_id WHERE h.user_id=? ORDER BY h.last_read_at DESC LIMIT 50").bind(session.sub).all(),
    context.env.DB.prepare("SELECT topic,created_at FROM topic_subscriptions WHERE user_id=? ORDER BY topic").bind(session.sub).all(),
    context.env.DB.prepare("SELECT query,searched_at FROM search_history WHERE user_id=? ORDER BY searched_at DESC LIMIT 20").bind(session.sub).all(),
    context.env.DB.prepare("SELECT id,title,url,read_at,created_at FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 30").bind(session.sub).all()
  ]);
  return json({ profile, history: history.results || [], topics: topics.results || [], searches: searches.results || [], notifications: notifications.results || [] });
}

export async function onRequestPatch(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireSession(context);
  if (!session) return json({ error: "Connexion requise." }, 401);
  try {
    const body = await readBody(context.request);
    if (body.action === "password") return changePassword(context, session, body);
    if (body.action === "request-deletion") return requestDeletion(context, session, body);

    const name = cleanText(body.name, 80);
    const requestedEmail = cleanText(body.email, 254).toLowerCase();
    const bio = cleanText(body.bio, 500);
    const avatar = cleanText(body.avatarUrl, 500);
    const language = languages.has(body.language) ? body.language : "fr";
    const theme = themes.has(body.theme) ? body.theme : "auto";
    const textSize = textSizes.has(body.textSize) ? body.textSize : "normal";
    const density = densities.has(body.density) ? body.density : "comfortable";
    const notifications = body.notifications === false ? 0 : 1;
    const preferredTopics = normalizeTopics(body.preferredTopics, body.preferredTopic);
    const preferredTopic = preferredTopics[0];
    const sponsoredInApp = body.sponsoredInApp === true ? 1 : 0;
    const sponsoredEmail = body.sponsoredEmail === true ? 1 : 0;
    if (name.length < 2 || !validEmail(requestedEmail) || !preferredTopics.length || (avatar && !/^https:\/\//i.test(avatar))) return json({ error: "Profil invalide : choisissez au moins une rubrique." }, 400);
    if (requestedEmail !== session.email.toLowerCase()) return json({ error: "La modification de l’adresse e-mail nécessite une vérification dédiée et n’est pas disponible depuis ce formulaire." }, 400);
    await context.env.DB.batch([
      context.env.DB.prepare("UPDATE users SET name=?,bio=?,avatar_url=?,preferred_language=?,preferred_theme=?,text_size=?,display_density=?,notifications_enabled=?,preferred_topic=?,sponsored_in_app=?,sponsored_email=? WHERE id=?").bind(name, bio, avatar || null, language, theme, textSize, density, notifications, preferredTopic, sponsoredInApp, sponsoredEmail, session.sub),
      context.env.DB.prepare("UPDATE newsletter_subscribers SET locale=?,brevo_sync_status=CASE WHEN locale<>? THEN 'pending' ELSE brevo_sync_status END,updated_at=? WHERE user_id=?").bind(language, language, new Date().toISOString(), session.sub)
    ]);
    await replaceTopicSubscriptions(context.env.DB, session.sub, preferredTopics);
    return json({ ok: true });
  } catch (error) {
    console.error("account_update_failed", error);
    return json({ error: error?.message === "PAYLOAD_TOO_LARGE" ? "Requête trop volumineuse." : "Modification impossible." }, error?.message === "PAYLOAD_TOO_LARGE" ? 413 : 400);
  }
}

async function changePassword(context, session, body) {
  const user = await context.env.DB.prepare("SELECT name,email,password_hash,preferred_language,session_version FROM users WHERE id=?").bind(session.sub).first();
  const currentPassword = String(body.currentPassword || "");
  const newPassword = String(body.newPassword || "");
  const confirmation = String(body.passwordConfirmation || "");
  if (!user || !(await verifyPassword(currentPassword, user.password_hash))) return json({ error: "Mot de passe actuel incorrect." }, 403);
  if (newPassword.length < 12 || newPassword.length > 128 || newPassword !== confirmation) return json({ error: "Le nouveau mot de passe doit contenir au moins 12 caractères et les deux saisies doivent correspondre." }, 400);
  const newVersion = Number(user.session_version || 1) + 1;
  await context.env.DB.prepare("UPDATE users SET password_hash=?,session_version=? WHERE id=?").bind(await hashPassword(newPassword), newVersion, session.sub).run();
  try { await sendSecurityEmail(context.env, { type: "changed", to: user.email, name: user.name, locale: user.preferred_language }); } catch (error) { console.error("password_changed_email_failed", error); }
  return json({ ok: true, sessionsRevoked: true }, 200, { "Set-Cookie": await createSessionCookie({ id: session.sub, name: session.name, email: session.email, role: session.role, session_version: newVersion }, context.env.SESSION_SECRET) });
}

async function requestDeletion(context, session, body) {
  if (session.role === "ADMIN") return json({ error: "Le compte administrateur principal ne peut pas être supprimé depuis l’interface." }, 403);
  const limit = await consumeRateLimit(context, "delete_account", session.sub);
  if (!limit.allowed) return rateLimitResponse(limit);
  if (body.confirmDeletion !== true) return json({ error: "Confirmez que vous comprenez que la suppression est définitive." }, 400);
  const user = await context.env.DB.prepare("SELECT name,email,password_hash,preferred_language FROM users WHERE id=?").bind(session.sub).first();
  if (!user || !(await verifyPassword(String(body.password || ""), user.password_hash))) return json({ error: "Mot de passe incorrect." }, 403);
  try {
    const challenge = await createOtpChallenge(context, session.sub, "ACCOUNT_DELETION");
    await sendSecurityEmail(context.env, { type: "deletionCode", to: user.email, name: user.name, locale: user.preferred_language, code: challenge.code });
    return json({ ok: true, verificationRequired: true, message: "Un code de suppression a été envoyé par e-mail." });
  } catch (error) {
    if (error.message === "OTP_COOLDOWN") return json({ error: "Un code a déjà été envoyé. Patientez une minute avant de recommencer.", retryAfter: error.retryAfter }, 429);
    throw error;
  }
}

export async function onRequestDelete(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireSession(context);
  if (!session) return json({ error: "Connexion requise." }, 401);
  if (session.role === "ADMIN") return json({ error: "Le compte administrateur principal ne peut pas être supprimé depuis l’interface." }, 403);
  try {
    const body = await readBody(context.request);
    const limit = await consumeRateLimit(context, "delete_account", session.sub);
    if (!limit.allowed) return rateLimitResponse(limit);
    const challenge = await consumeOtpChallenge(context, session.sub, "ACCOUNT_DELETION", body.code);
    if (!challenge.ok) return json({ error: challenge.reason === "locked" ? "Trop de codes incorrects. Recommencez la procédure." : "Code invalide ou expiré." }, 400);
    const user = await context.env.DB.prepare("SELECT id,name,email,preferred_language FROM users WHERE id=? AND role<>'ADMIN'").bind(session.sub).first();
    if (!user) return json({ error: "Suppression refusée." }, 403);
    try { await sendSecurityEmail(context.env, { type: "deleted", to: user.email, name: user.name, locale: user.preferred_language }); } catch (error) { console.error("account_deleted_email_failed", error); }
    try { await removeMirroredUser(context.env, user.id, user.email); } catch (error) { console.error("supabase_user_delete_failed", error); }
    const now = new Date().toISOString();
    await context.env.DB.batch([
      context.env.DB.prepare("DELETE FROM newsletter_subscribers WHERE user_id=? OR lower(email)=lower(?)").bind(user.id, user.email),
      context.env.DB.prepare("INSERT INTO admin_notifications(id,type,title,body,target_url,target_type,target_id,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "account", "Compte supprimé par son titulaire", "Un utilisateur a confirmé la suppression définitive de son compte.", "/admin/#accounts", "user", user.id, now),
      context.env.DB.prepare("DELETE FROM users WHERE id=? AND role<>'ADMIN'").bind(user.id)
    ]);
    return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie() });
  } catch (error) {
    console.error("account_deletion_failed", error);
    return json({ error: "Suppression impossible pour le moment." }, 500);
  }
}

import { cleanText, hashPassword, json, readBody, requireSession, sameOrigin, validEmail, verifyPassword } from "../_lib/auth.js";
import { normalizeTopics, replaceTopicSubscriptions } from "../_lib/topics.js";

const languages = new Set(["fr", "en", "ar"]);
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
    if (body.action === "password") {
      const user = await context.env.DB.prepare("SELECT password_hash FROM users WHERE id=?").bind(session.sub).first();
      const currentPassword = String(body.currentPassword || ""); const newPassword = String(body.newPassword || "");
      if (!user || !(await verifyPassword(currentPassword, user.password_hash))) return json({ error: "Mot de passe actuel incorrect." }, 403);
      if (newPassword.length < 6 || newPassword.length > 128) return json({ error: "Le nouveau mot de passe doit contenir au moins 6 caractères." }, 400);
      await context.env.DB.prepare("UPDATE users SET password_hash=? WHERE id=?").bind(await hashPassword(newPassword), session.sub).run();
      return json({ ok: true });
    }
    const name = cleanText(body.name, 80); const email = cleanText(body.email, 254).toLowerCase();
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
    if (name.length < 2 || !validEmail(email) || !preferredTopics.length || (avatar && !/^https:\/\//i.test(avatar))) return json({ error: "Profil invalide : choisissez au moins une rubrique." }, 400);
    try {
      await context.env.DB.batch([context.env.DB.prepare("UPDATE users SET name=?,email=?,bio=?,avatar_url=?,preferred_language=?,preferred_theme=?,text_size=?,display_density=?,notifications_enabled=?,preferred_topic=?,sponsored_in_app=?,sponsored_email=? WHERE id=?").bind(name, email, bio, avatar || null, language, theme, textSize, density, notifications, preferredTopic, sponsoredInApp, sponsoredEmail, session.sub),context.env.DB.prepare("UPDATE newsletter_subscribers SET email=?,locale=?,brevo_previous_email=CASE WHEN lower(email)<>lower(?) THEN email ELSE brevo_previous_email END,brevo_sync_status=CASE WHEN lower(email)<>lower(?) OR locale<>? THEN 'pending' ELSE brevo_sync_status END,updated_at=? WHERE user_id=?").bind(email,language,email,email,language,new Date().toISOString(),session.sub)]);
      await replaceTopicSubscriptions(context.env.DB, session.sub, preferredTopics);
    } catch { return json({ error: "Cette adresse e-mail est déjà utilisée." }, 409); }
    return json({ ok: true });
  } catch (error) { return json({ error: error?.message === "PAYLOAD_TOO_LARGE" ? "Requête trop volumineuse." : "Modification impossible." }, 400); }
}

export async function onRequestDelete(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireSession(context);
  if (!session) return json({ error: "Connexion requise." }, 401);
  const body = await readBody(context.request).catch(() => ({}));
  const user = await context.env.DB.prepare("SELECT password_hash FROM users WHERE id=?").bind(session.sub).first();
  if (!user || !(await verifyPassword(String(body.password || ""), user.password_hash))) return json({ error: "Mot de passe incorrect." }, 403);
  try { await context.env.DB.prepare("INSERT INTO admin_notifications(id,type,title,body,target_url,target_type,target_id,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(), "account", "Compte supprimé par son titulaire", "Un utilisateur a confirmé la suppression définitive de son compte.", "/admin/#accounts", "user", session.sub, new Date().toISOString()).run(); } catch (error) { console.error("admin_notification_failed", error); }
  await context.env.DB.prepare("DELETE FROM users WHERE id=? AND role<>'ADMIN'").bind(session.sub).run();
  return json({ ok: true }, 200, { "Set-Cookie": "tamusni_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" });
}

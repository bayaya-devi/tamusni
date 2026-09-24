import { cleanText, json, readBody, requireSession, sameOrigin, verifyPassword } from "../_lib/auth.js";

const languages = new Set(["fr", "en", "ar"]);
const themes = new Set(["auto", "light", "dark"]);
const textSizes = new Set(["small", "normal", "large"]);
const densities = new Set(["compact", "comfortable"]);

export async function onRequestGet(context) {
  const session = await requireSession(context);
  if (!session) return json({ error: "Connexion requise." }, 401);
  const [profile, history, topics, searches, notifications] = await Promise.all([
    context.env.DB.prepare("SELECT id,name,email,role,avatar_url,bio,preferred_language,preferred_theme,text_size,display_density,notifications_enabled,created_at FROM users WHERE id=?").bind(session.sub).first(),
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
    const name = cleanText(body.name, 80);
    const bio = cleanText(body.bio, 500);
    const avatar = cleanText(body.avatarUrl, 500);
    const language = languages.has(body.language) ? body.language : "fr";
    const theme = themes.has(body.theme) ? body.theme : "auto";
    const textSize = textSizes.has(body.textSize) ? body.textSize : "normal";
    const density = densities.has(body.density) ? body.density : "comfortable";
    const notifications = body.notifications === false ? 0 : 1;
    if (name.length < 2 || (avatar && !/^https:\/\//i.test(avatar))) return json({ error: "Profil invalide. La photo doit utiliser une adresse HTTPS." }, 400);
    await context.env.DB.prepare("UPDATE users SET name=?,bio=?,avatar_url=?,preferred_language=?,preferred_theme=?,text_size=?,display_density=?,notifications_enabled=? WHERE id=?").bind(name, bio, avatar || null, language, theme, textSize, density, notifications, session.sub).run();
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
  await context.env.DB.prepare("DELETE FROM users WHERE id=? AND role<>'ADMIN'").bind(session.sub).run();
  return json({ ok: true }, 200, { "Set-Cookie": "tamusni_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0" });
}

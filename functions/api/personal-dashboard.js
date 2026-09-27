import { json, requireSession } from "../_lib/auth.js";

export async function onRequestGet(context) {
  const session = await requireSession(context);
  if (!session) return json({ error: "Connexion requise." }, 401);
  const db = context.env.DB;
  const profile = await db.prepare("SELECT name,email,preferred_topic,preferred_language,preferred_theme,notifications_enabled,sponsored_in_app,sponsored_email,created_at FROM users WHERE id=?").bind(session.sub).first();
  const subscriptions = await db.prepare("SELECT topic FROM topic_subscriptions WHERE user_id=?").bind(session.sub).all();
  const interests = [...new Set([profile?.preferred_topic, ...(subscriptions.results || []).map(item => item.topic)].filter(Boolean))].slice(0, 6);
  const params = [new Date().toISOString()];
  let where = "status='published' AND published_at<=?";
  if (interests.length) { where += ` AND LOWER(category) IN (${interests.map(() => "?").join(",")})`; params.push(...interests.map(value => value.toLowerCase())); }
  const [feed, latest, saved, notifications] = await Promise.all([
    db.prepare(`SELECT id,slug,type,title,excerpt,category,cover_url,published_at FROM content_items WHERE ${where} ORDER BY published_at DESC LIMIT 12`).bind(...params).all(),
    db.prepare("SELECT slug,type,title,excerpt,category,cover_url,published_at FROM content_items WHERE status='published' AND published_at<=? ORDER BY published_at DESC LIMIT 4").bind(new Date().toISOString()).all(),
    db.prepare("SELECT item_id,item_type,title,url,created_at FROM saved_items WHERE user_id=? ORDER BY created_at DESC LIMIT 6").bind(session.sub).all(),
    db.prepare("SELECT id,title,url,read_at,created_at FROM notifications WHERE user_id=? ORDER BY read_at IS NULL DESC,created_at DESC LIMIT 6").bind(session.sub).all()
  ]);
  return json({ profile, interests, feed: feed.results || [], latest: latest.results || [], saved: saved.results || [], notifications: notifications.results || [] });
}

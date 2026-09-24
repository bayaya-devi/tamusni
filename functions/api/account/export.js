import { json, requireSession } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const session = await requireSession(context);
  if (!session) return json({ error: "Connexion requise." }, 401);
  const tables = {
    profile: await context.env.DB.prepare("SELECT id,name,email,role,avatar_url,bio,preferred_language,preferred_theme,text_size,display_density,notifications_enabled,created_at FROM users WHERE id=?").bind(session.sub).first(),
    favorites: (await context.env.DB.prepare("SELECT item_id,item_type,title,url,created_at FROM saved_items WHERE user_id=? ORDER BY created_at DESC").bind(session.sub).all()).results || [],
    history: (await context.env.DB.prepare("SELECT content_id,progress,last_read_at FROM reading_history WHERE user_id=? ORDER BY last_read_at DESC").bind(session.sub).all()).results || [],
    topics: (await context.env.DB.prepare("SELECT topic,created_at FROM topic_subscriptions WHERE user_id=?").bind(session.sub).all()).results || [],
    comments: (await context.env.DB.prepare("SELECT content_id,body,status,created_at,updated_at FROM comments WHERE user_id=? ORDER BY created_at DESC").bind(session.sub).all()).results || [],
    reactions: (await context.env.DB.prepare("SELECT content_id,reaction,created_at FROM reactions WHERE user_id=?").bind(session.sub).all()).results || [],
    searches: (await context.env.DB.prepare("SELECT query,searched_at FROM search_history WHERE user_id=? ORDER BY searched_at DESC").bind(session.sub).all()).results || []
  };
  return new Response(JSON.stringify({ exportedAt: new Date().toISOString(), ...tables }, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": "attachment; filename=tamusni-donnees.json", "Cache-Control": "no-store" } });
}

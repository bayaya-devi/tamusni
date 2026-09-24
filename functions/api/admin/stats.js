import { json, requireAdmin } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const session = await requireAdmin(context);
  if (!session) return json({ error: "Accès réservé à l’administration." }, 403);
  const [users, subscribers, favorites, live, content, comments, reports, views] = await Promise.all([
    context.env.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'USER'").first(),
    context.env.DB.prepare("SELECT COUNT(*) AS count FROM newsletter_subscribers").first(),
    context.env.DB.prepare("SELECT COUNT(*) AS count FROM saved_items").first(),
    context.env.DB.prepare("SELECT COUNT(*) AS count FROM live_updates WHERE active = 1").first(),
    context.env.DB.prepare("SELECT COUNT(*) AS count FROM content_items WHERE status='published'").first(),
    context.env.DB.prepare("SELECT COUNT(*) AS count FROM comments WHERE status IN ('pending','reported')").first(),
    context.env.DB.prepare("SELECT COUNT(*) AS count FROM reports WHERE status='open'").first(),
    context.env.DB.prepare("SELECT COUNT(*) AS count FROM content_views").first()
  ]);
  return json({ users: users?.count || 0, subscribers: subscribers?.count || 0, favorites: favorites?.count || 0, live: live?.count || 0, content: content?.count || 0, comments: comments?.count || 0, reports: reports?.count || 0, views: views?.count || 0 });
}

import { json, requireSession } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const session = await requireSession(context);
  if (!session) return json({ error: "Connexion requise." }, 401);
  if (session.role !== "ADMIN") return json({ error: "Accès réservé à l’administration." }, 403);
  const [users, subscribers, favorites, live] = await Promise.all([
    context.env.DB.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'USER'").first(),
    context.env.DB.prepare("SELECT COUNT(*) AS count FROM newsletter_subscribers").first(),
    context.env.DB.prepare("SELECT COUNT(*) AS count FROM saved_items").first(),
    context.env.DB.prepare("SELECT COUNT(*) AS count FROM live_updates WHERE active = 1").first()
  ]);
  return json({ users: users?.count || 0, subscribers: subscribers?.count || 0, favorites: favorites?.count || 0, live: live?.count || 0 });
}

import { cleanText, json, readBody, requireSession, sameOrigin } from "../_lib/auth.js";

export async function onRequestGet(context) {
  const session = await requireSession(context); if (!session) return json({ error: "Connexion requise." }, 401);
  const result = await context.env.DB.prepare("SELECT id,title,url,read_at,created_at FROM notifications WHERE user_id=? ORDER BY read_at IS NULL DESC,created_at DESC LIMIT 100").bind(session.sub).all();
  return json({ items: result.results || [] });
}

export async function onRequestPatch(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireSession(context); if (!session) return json({ error: "Connexion requise." }, 401);
  const body = await readBody(context.request); const id = cleanText(body.id, 160);
  if (!id || !["read", "unread"].includes(body.action)) return json({ error: "Notification invalide." }, 400);
  await context.env.DB.prepare("UPDATE notifications SET read_at=? WHERE id=? AND user_id=?").bind(body.action === "read" ? new Date().toISOString() : null, id, session.sub).run();
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireSession(context); if (!session) return json({ error: "Connexion requise." }, 401);
  const body = await readBody(context.request); const id = cleanText(body.id, 160);
  if (!id) return json({ error: "Notification invalide." }, 400);
  await context.env.DB.prepare("DELETE FROM notifications WHERE id=? AND user_id=?").bind(id, session.sub).run();
  return json({ ok: true });
}

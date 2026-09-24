import { json, readBody, requireSession, sameOrigin } from "../_lib/auth.js";

const allowedTypes = new Set(["article", "video"]);

export async function onRequestGet(context) {
  const session = await requireSession(context);
  if (!session) return json({ error: "Connexion requise." }, 401);
  const result = await context.env.DB.prepare("SELECT item_id, item_type, title, url, created_at FROM saved_items WHERE user_id = ? ORDER BY created_at DESC").bind(session.sub).all();
  return json({ items: result.results || [] });
}

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireSession(context);
  if (!session) return json({ error: "Connexion requise.", login: "/connexion/" }, 401);
  try {
    const body = await readBody(context.request);
    const itemId = String(body.itemId || "").trim().slice(0, 160);
    const itemType = String(body.itemType || "article").trim();
    const title = String(body.title || "").trim().slice(0, 240);
    const url = String(body.url || "").trim().slice(0, 500);
    if (!itemId || !title || !url.startsWith("/") || !allowedTypes.has(itemType)) return json({ error: "Favori invalide." }, 400);
    await context.env.DB.prepare("INSERT INTO saved_items (user_id, item_id, item_type, title, url, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(user_id, item_id) DO UPDATE SET title = excluded.title, url = excluded.url, item_type = excluded.item_type").bind(session.sub, itemId, itemType, title, url, new Date().toISOString()).run();
    return json({ ok: true, saved: true }, 201);
  } catch (error) { return json({ error: error?.message === "PAYLOAD_TOO_LARGE" ? "Requête trop volumineuse." : "Enregistrement impossible." }, 400); }
}

export async function onRequestDelete(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireSession(context);
  if (!session) return json({ error: "Connexion requise." }, 401);
  try {
    const { itemId } = await readBody(context.request);
    await context.env.DB.prepare("DELETE FROM saved_items WHERE user_id = ? AND item_id = ?").bind(session.sub, String(itemId || "").slice(0, 160)).run();
    return json({ ok: true, saved: false });
  } catch { return json({ error: "Suppression impossible." }, 400); }
}

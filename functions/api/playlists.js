import { cleanText, json, readBody, requireSession, sameOrigin } from "../_lib/auth.js";
export async function onRequestGet(context) {
  const session = await requireSession(context); if (!session) return json({ error: "Connexion requise." }, 401);
  const result = await context.env.DB.prepare("SELECT p.id,p.name,p.created_at,COUNT(pi.content_id) AS items FROM playlists p LEFT JOIN playlist_items pi ON pi.playlist_id=p.id WHERE p.user_id=? GROUP BY p.id ORDER BY p.created_at DESC").bind(session.sub).all();
  return json({ playlists: result.results || [] });
}
export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireSession(context); if (!session) return json({ error: "Connexion requise." }, 401);
  const body = await readBody(context.request); const name = cleanText(body.name, 80);
  if (name.length < 2) return json({ error: "Nom de playlist invalide." }, 400);
  const id = crypto.randomUUID(); await context.env.DB.prepare("INSERT INTO playlists(id,user_id,name,created_at) VALUES(?,?,?,?)").bind(id, session.sub, name, new Date().toISOString()).run();
  return json({ ok: true, id }, 201);
}
export async function onRequestPatch(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireSession(context); if (!session) return json({ error: "Connexion requise." }, 401);
  const body = await readBody(context.request); const playlistId = cleanText(body.playlistId, 160); const contentId = cleanText(body.contentId, 160);
  const playlist = await context.env.DB.prepare("SELECT id FROM playlists WHERE id=? AND user_id=?").bind(playlistId, session.sub).first();
  const content = await context.env.DB.prepare("SELECT id FROM content_items WHERE id=? AND type IN ('video','podcast') AND status='published'").bind(contentId).first();
  if (!playlist || !content) return json({ error: "Playlist ou média invalide." }, 404);
  await context.env.DB.prepare("INSERT OR IGNORE INTO playlist_items(playlist_id,content_id,position,created_at) VALUES(?,?,(SELECT COUNT(*) FROM playlist_items WHERE playlist_id=?),?)").bind(playlistId, contentId, playlistId, new Date().toISOString()).run();
  return json({ ok: true });
}
export async function onRequestDelete(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireSession(context); if (!session) return json({ error: "Connexion requise." }, 401);
  const body = await readBody(context.request); const playlistId = cleanText(body.playlistId, 160);
  await context.env.DB.prepare("DELETE FROM playlists WHERE id=? AND user_id=?").bind(playlistId, session.sub).run();
  return json({ ok: true });
}

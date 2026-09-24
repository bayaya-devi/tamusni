import { cleanText, json, readBody, requireSession, sameOrigin } from "../_lib/auth.js";
export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireSession(context); if (!session) return json({ error: "Connexion requise." }, 401);
  const body = await readBody(context.request); const contentId = cleanText(body.contentId, 160); const comment = cleanText(body.body, 2000);
  if (!contentId || comment.length < 3) return json({ error: "Commentaire invalide." }, 400);
  const exists = await context.env.DB.prepare("SELECT id FROM content_items WHERE id=? AND status='published'").bind(contentId).first();
  if (!exists) return json({ error: "Contenu introuvable." }, 404);
  await context.env.DB.prepare("INSERT INTO comments(id,content_id,user_id,body,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(), contentId, session.sub, comment, "pending", new Date().toISOString(), new Date().toISOString()).run();
  return json({ ok: true, message: "Commentaire envoyé à la modération." }, 201);
}

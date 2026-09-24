import { cleanText, json, readBody, requireSession, sameOrigin } from "../_lib/auth.js";
const allowed = new Set(["utile", "clair", "surprenant", "important"]);
export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireSession(context); if (!session) return json({ error: "Connexion requise." }, 401);
  const body = await readBody(context.request); const contentId = cleanText(body.contentId, 160); const reaction = cleanText(body.reaction, 20);
  if (!contentId || !allowed.has(reaction)) return json({ error: "Réaction invalide." }, 400);
  await context.env.DB.prepare("INSERT INTO reactions(user_id,content_id,reaction,created_at) VALUES(?,?,?,?) ON CONFLICT(user_id,content_id) DO UPDATE SET reaction=excluded.reaction,created_at=excluded.created_at").bind(session.sub, contentId, reaction, new Date().toISOString()).run();
  return json({ ok: true }, 201);
}

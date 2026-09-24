import { cleanText, json, readBody, requireSession, sameOrigin } from "../_lib/auth.js";

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireSession(context); if (!session) return json({ error: "Connexion requise." }, 401);
  const body = await readBody(context.request); const topic = cleanText(body.topic, 80);
  if (topic.length < 2) return json({ error: "Sujet invalide." }, 400);
  await context.env.DB.prepare("INSERT OR IGNORE INTO topic_subscriptions(user_id,topic,created_at) VALUES(?,?,?)").bind(session.sub, topic, new Date().toISOString()).run();
  return json({ ok: true }, 201);
}
export async function onRequestDelete(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireSession(context); if (!session) return json({ error: "Connexion requise." }, 401);
  const body = await readBody(context.request); const topic = cleanText(body.topic, 80);
  await context.env.DB.prepare("DELETE FROM topic_subscriptions WHERE user_id=? AND topic=?").bind(session.sub, topic).run();
  return json({ ok: true });
}

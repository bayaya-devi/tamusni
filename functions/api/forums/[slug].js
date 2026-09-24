import { cleanText, json, readBody, requireSession, sameOrigin } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const slug = cleanText(context.params.slug, 160);
  const topic = await context.env.DB.prepare("SELECT id,slug,title,description,status,created_at,updated_at FROM forum_topics WHERE slug=? AND status IN ('open','locked')").bind(slug).first();
  if (!topic) return json({ error: "Sujet introuvable." }, 404);
  const posts = await context.env.DB.prepare("SELECT p.id,p.parent_id,p.body,p.created_at,u.name,u.avatar_url FROM forum_posts p JOIN users u ON u.id=p.user_id WHERE p.topic_id=? AND p.status='approved' ORDER BY p.created_at LIMIT 200").bind(topic.id).all();
  return json({ topic, posts: posts.results || [] });
}

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireSession(context);
  if (!session) return json({ error: "Connexion requise pour participer." }, 401);
  const slug = cleanText(context.params.slug, 160);
  const topic = await context.env.DB.prepare("SELECT id,status FROM forum_topics WHERE slug=?").bind(slug).first();
  if (!topic || topic.status !== "open") return json({ error: "Discussion fermée." }, 400);
  const body = await readBody(context.request); const message = cleanText(body.body, 3000); const parentId = cleanText(body.parentId, 160) || null;
  if (message.length < 3) return json({ error: "Message trop court." }, 400);
  if (parentId) { const parent = await context.env.DB.prepare("SELECT id FROM forum_posts WHERE id=? AND topic_id=?").bind(parentId, topic.id).first(); if (!parent) return json({ error: "Réponse parente introuvable." }, 400); }
  const now = new Date().toISOString();
  await context.env.DB.prepare("INSERT INTO forum_posts(id,topic_id,user_id,parent_id,body,status,created_at,updated_at) VALUES(?,?,?,?,?,'pending',?,?)").bind(crypto.randomUUID(), topic.id, session.sub, parentId, message, now, now).run();
  await context.env.DB.prepare("UPDATE forum_topics SET updated_at=? WHERE id=?").bind(now, topic.id).run();
  return json({ ok: true, message: "Message envoyé à la modération." }, 201);
}

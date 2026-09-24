import { cleanText, json, readBody, requireSession, sameOrigin } from "../_lib/auth.js";

export async function onRequestGet(context) {
  const result = await context.env.DB.prepare("SELECT t.id,t.slug,t.title,t.description,t.status,t.updated_at,COUNT(CASE WHEN p.status='approved' THEN 1 END) AS posts FROM forum_topics t LEFT JOIN forum_posts p ON p.topic_id=t.id WHERE t.status IN ('open','locked') GROUP BY t.id ORDER BY t.updated_at DESC").all();
  return json({ items: result.results || [] });
}

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireSession(context);
  if (!session) return json({ error: "Connexion requise." }, 401);
  const body = await readBody(context.request);
  const title = cleanText(body.title, 120);
  const description = cleanText(body.description, 500);
  const slug = cleanText(body.slug || title, 140).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (title.length < 5 || slug.length < 3) return json({ error: "Sujet invalide." }, 400);
  try {
    const id = crypto.randomUUID(); const now = new Date().toISOString();
    await context.env.DB.prepare("INSERT INTO forum_topics(id,slug,title,description,created_by,status,created_at,updated_at) VALUES(?,?,?,?,?,'pending',?,?)").bind(id, slug, title, description, session.sub, now, now).run();
    return json({ ok: true, id, slug, pending: true, message: "Sujet envoyé à la modération." }, 201);
  } catch { return json({ error: "Ce sujet existe déjà." }, 409); }
}

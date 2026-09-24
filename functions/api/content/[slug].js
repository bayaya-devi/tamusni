import { cleanText, json, readBody, requireSession, sameOrigin } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const slug = cleanText(context.params.slug, 160);
  const item = await context.env.DB.prepare("SELECT id,slug,type,title,excerpt,body,summary,category,author_name,cover_url,media_url,transcript,subtitles_url,fact_check_status,sponsored,sponsor_name,published_at,updated_at FROM content_items WHERE slug=? AND status='published' AND published_at<=?").bind(slug, new Date().toISOString()).first();
  if (!item) return json({ error: "Contenu introuvable." }, 404);
  const [sources, tags, timeline, reactions, comments, related] = await Promise.all([
    context.env.DB.prepare("SELECT label,url,publisher,published_at FROM content_sources WHERE content_id=? ORDER BY created_at").bind(item.id).all(),
    context.env.DB.prepare("SELECT t.slug,t.name FROM tags t JOIN content_tags ct ON ct.tag_id=t.id WHERE ct.content_id=? ORDER BY t.name").bind(item.id).all(),
    context.env.DB.prepare("SELECT event_date,title,description FROM content_timeline_events WHERE content_id=? ORDER BY position,event_date").bind(item.id).all(),
    context.env.DB.prepare("SELECT reaction,COUNT(*) AS count FROM reactions WHERE content_id=? GROUP BY reaction").bind(item.id).all(),
    context.env.DB.prepare("SELECT c.id,c.body,c.created_at,u.name FROM comments c JOIN users u ON u.id=c.user_id WHERE c.content_id=? AND c.status='approved' ORDER BY c.created_at DESC LIMIT 50").bind(item.id).all(),
    context.env.DB.prepare("SELECT DISTINCT r.slug,r.type,r.title,r.excerpt,r.category,r.published_at FROM content_items r JOIN content_tags rt ON rt.content_id=r.id JOIN content_tags current ON current.tag_id=rt.tag_id WHERE current.content_id=? AND r.id<>? AND r.status='published' ORDER BY r.published_at DESC LIMIT 4").bind(item.id, item.id).all()
  ]);
  return json({ item, sources: sources.results || [], tags: tags.results || [], timeline: timeline.results || [], reactions: reactions.results || [], comments: comments.results || [], related: related.results || [] });
}

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const slug = cleanText(context.params.slug, 160);
  const item = await context.env.DB.prepare("SELECT id FROM content_items WHERE slug=? AND status='published'").bind(slug).first();
  if (!item) return json({ error: "Contenu introuvable." }, 404);
  const session = await requireSession(context);
  const now = new Date().toISOString();
  await context.env.DB.prepare("INSERT INTO content_views(id,content_id,user_id,viewed_at) VALUES(?,?,?,?)").bind(crypto.randomUUID(), item.id, session?.sub || null, now).run();
  if (session) {
    const body = await readBody(context.request).catch(() => ({}));
    const progress = Math.min(Math.max(Number(body.progress) || 0, 0), 100);
    await context.env.DB.prepare("INSERT INTO reading_history(user_id,content_id,progress,last_read_at) VALUES(?,?,?,?) ON CONFLICT(user_id,content_id) DO UPDATE SET progress=excluded.progress,last_read_at=excluded.last_read_at").bind(session.sub, item.id, progress, now).run();
  }
  return json({ ok: true }, 201);
}

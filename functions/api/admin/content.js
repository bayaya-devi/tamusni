import { cleanText, json, readBody, requireAdmin, sameOrigin } from "../../_lib/auth.js";
const types = new Set(["article", "video", "podcast"]);
const statuses = new Set(["draft", "review", "scheduled", "published", "archived"]);
const checks = new Set(["verified", "context", "correction", "opinion"]);
const httpsUrl = (value) => /^https:\/\//i.test(String(value || "")) ? String(value) : null;
const slugify = (value) => cleanText(value,160).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9-]/g,"-").replace(/-+/g,"-").replace(/^-|-$/g,"");

async function audit(context, admin, action, targetId, metadata = {}) {
  await context.env.DB.prepare("INSERT INTO admin_audit_log(id,admin_user_id,action,target_type,target_id,metadata,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),admin.sub,action,"content",targetId,JSON.stringify(metadata),new Date().toISOString()).run();
}
async function replaceTags(context, id, rawTags) {
  await context.env.DB.prepare("DELETE FROM content_tags WHERE content_id=?").bind(id).run();
  const names = String(rawTags || "").split(",").map((tag) => cleanText(tag,60)).filter(Boolean).slice(0,10);
  for (const name of names) {
    const slug = slugify(name); if (!slug) continue;
    await context.env.DB.prepare("INSERT OR IGNORE INTO tags(id,slug,name) VALUES(?,?,?)").bind(crypto.randomUUID(),slug,name).run();
    const tag = await context.env.DB.prepare("SELECT id FROM tags WHERE slug=?").bind(slug).first();
    if (tag) await context.env.DB.prepare("INSERT OR IGNORE INTO content_tags(content_id,tag_id) VALUES(?,?)").bind(id,tag.id).run();
  }
}
async function replaceSource(context, id, body, now) {
  await context.env.DB.prepare("DELETE FROM content_sources WHERE content_id=?").bind(id).run();
  const url = httpsUrl(body.sourceUrl); const label = cleanText(body.sourceLabel,200);
  if (url && label) await context.env.DB.prepare("INSERT INTO content_sources(id,content_id,label,url,publisher,created_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),id,label,url,cleanText(body.sourcePublisher,120),now).run();
}

export async function onRequestGet(context) {
  if (!await requireAdmin(context)) return json({ error: "Accès réservé à l’administration." }, 403);
  const id = cleanText(new URL(context.request.url).searchParams.get("id"),160);
  if (id) {
    const item = await context.env.DB.prepare("SELECT * FROM content_items WHERE id=?").bind(id).first();
    if (!item) return json({ error: "Contenu introuvable." }, 404);
    const [sources,tags] = await Promise.all([
      context.env.DB.prepare("SELECT label,url,publisher FROM content_sources WHERE content_id=? ORDER BY created_at").bind(id).all(),
      context.env.DB.prepare("SELECT t.name FROM tags t JOIN content_tags ct ON ct.tag_id=t.id WHERE ct.content_id=? ORDER BY t.name").bind(id).all()
    ]);
    return json({ item, sources: sources.results || [], tags: tags.results || [] });
  }
  const result = await context.env.DB.prepare("SELECT id,slug,type,status,title,category,author_name,fact_check_status,sponsored,published_at,scheduled_at,updated_at FROM content_items ORDER BY updated_at DESC LIMIT 100").all();
  return json({ items: result.results || [] });
}

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const admin = await requireAdmin(context); if (!admin) return json({ error: "Accès réservé à l’administration." }, 403);
  const body = await readBody(context.request); const title = cleanText(body.title,240); const slug = slugify(body.slug); const now = new Date().toISOString();
  const type = types.has(body.type) ? body.type : "article"; const status = statuses.has(body.status) ? body.status : "draft";
  if (title.length < 5 || slug.length < 3) return json({ error: "Titre ou URL invalide." }, 400);
  const id = crypto.randomUUID();
  try {
    await context.env.DB.prepare("INSERT INTO content_items(id,slug,type,status,title,excerpt,body,summary,category,author_name,cover_url,media_url,transcript,subtitles_url,fact_check_status,sponsored,sponsor_name,published_at,scheduled_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,slug,type,status,title,cleanText(body.excerpt,500),cleanText(body.body,15000),cleanText(body.summary,1000),cleanText(body.category,80)||"Actualité",cleanText(body.authorName,100)||"Rédaction TAMUSNI",httpsUrl(body.coverUrl),httpsUrl(body.mediaUrl),cleanText(body.transcript,15000),httpsUrl(body.subtitlesUrl),checks.has(body.factCheckStatus)?body.factCheckStatus:"verified",body.sponsored?1:0,cleanText(body.sponsorName,100)||null,status==="published"?(body.publishedAt||now):null,status==="scheduled"?(body.scheduledAt||null):null,now,now).run();
    await replaceSource(context,id,body,now); await replaceTags(context,id,body.tags); await audit(context,admin,"content.create",id,{slug,status});
    return json({ ok:true,id,slug },201);
  } catch { return json({ error: "Cette URL est déjà utilisée." }, 409); }
}

export async function onRequestPatch(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const admin = await requireAdmin(context); if (!admin) return json({ error: "Accès réservé à l’administration." }, 403);
  const body = await readBody(context.request); const id = cleanText(body.id,160); const existing = id ? await context.env.DB.prepare("SELECT * FROM content_items WHERE id=?").bind(id).first() : null;
  if (!existing) return json({ error: "Contenu introuvable." }, 404);
  const now = new Date().toISOString();
  if (body.action === "update") {
    await context.env.DB.prepare("INSERT INTO content_revisions(id,content_id,editor_user_id,snapshot_json,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),id,admin.sub,JSON.stringify(existing),now).run();
    const title=cleanText(body.title,240), slug=slugify(body.slug), type=types.has(body.type)?body.type:existing.type, status=statuses.has(body.status)?body.status:existing.status;
    if(title.length<5||slug.length<3)return json({error:"Titre ou URL invalide."},400);
    try {
      await context.env.DB.prepare("UPDATE content_items SET slug=?,type=?,status=?,title=?,excerpt=?,body=?,summary=?,category=?,author_name=?,cover_url=?,media_url=?,transcript=?,subtitles_url=?,fact_check_status=?,sponsored=?,sponsor_name=?,published_at=?,scheduled_at=?,updated_at=? WHERE id=?").bind(slug,type,status,title,cleanText(body.excerpt,500),cleanText(body.body,15000),cleanText(body.summary,1000),cleanText(body.category,80)||"Actualité",cleanText(body.authorName,100)||"Rédaction TAMUSNI",httpsUrl(body.coverUrl),httpsUrl(body.mediaUrl),cleanText(body.transcript,15000),httpsUrl(body.subtitlesUrl),checks.has(body.factCheckStatus)?body.factCheckStatus:"verified",body.sponsored?1:0,cleanText(body.sponsorName,100)||null,status==="published"?(existing.published_at||now):existing.published_at,status==="scheduled"?(body.scheduledAt||existing.scheduled_at):null,now,id).run();
      await replaceSource(context,id,body,now); await replaceTags(context,id,body.tags); await audit(context,admin,"content.update",id,{slug,status});
      return json({ok:true,slug});
    } catch { return json({error:"Cette URL est déjà utilisée."},409); }
  }
  const status=statuses.has(body.status)?body.status:null; if(!status)return json({error:"Modification invalide."},400);
  const publishedAt=status==="published"?(body.publishedAt||existing.published_at||now):existing.published_at; const scheduledAt=status==="scheduled"?(body.scheduledAt||existing.scheduled_at):null;
  await context.env.DB.prepare("UPDATE content_items SET status=?,published_at=?,scheduled_at=?,updated_at=? WHERE id=?").bind(status,publishedAt,scheduledAt,now,id).run();
  if(status==="published")await context.env.DB.prepare("INSERT INTO notifications(id,user_id,title,url,created_at) SELECT lower(hex(randomblob(16))),user_id,?,?,? FROM topic_subscriptions WHERE LOWER(topic)=LOWER(?)").bind(`Nouveau contenu : ${existing.title}`,`/articles/${existing.slug}`,now,existing.category).run();
  await audit(context,admin,"content.status",id,{status}); return json({ok:true});
}

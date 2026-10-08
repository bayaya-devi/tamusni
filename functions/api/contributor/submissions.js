import { cleanText, json, readBody, requireContributor, sameOrigin } from "../../_lib/auth.js";

const categories = new Set(["Intelligence artificielle", "Innovation", "Robotique", "Cybersécurité", "Espace"]);
const types = new Set(["article", "brief"]);
const cleanUrl = value => {
  try { const url = new URL(String(value || "")); return url.protocol === "https:" ? url.href : null; } catch { return null; }
};

async function listSources(db, id) {
  const result = await db.prepare("SELECT label,url,publisher,note FROM contributor_submission_sources WHERE submission_id=? ORDER BY created_at").bind(id).all();
  return result.results || [];
}

export async function onRequestGet(context) {
  const user = await requireContributor(context);
  if (!user) return json({ error: "Accès réservé aux contributeurs." }, 403);
  const id = cleanText(new URL(context.request.url).searchParams.get("id"), 160);
  if (id) {
    const item = await context.env.DB.prepare("SELECT id,type,category,title,slug,excerpt,body,cover_url,status,review_reason,created_at,updated_at,submitted_at,reviewed_at,published_content_id FROM contributor_submissions WHERE id=? AND owner_user_id=?").bind(id,user.sub).first();
    if (!item) return json({ error: "Contenu introuvable." }, 404);
    return json({ item, sources: await listSources(context.env.DB,id) });
  }
  const result = await context.env.DB.prepare("SELECT s.id,s.type,s.category,s.title,s.slug,s.status,s.review_reason,s.created_at,s.updated_at,s.submitted_at,s.reviewed_at,s.published_content_id,c.slug AS published_slug FROM contributor_submissions s LEFT JOIN content_items c ON c.id=s.published_content_id WHERE s.owner_user_id=? ORDER BY s.updated_at DESC LIMIT 100").bind(user.sub).all();
  return json({ items: result.results || [] });
}

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const user = await requireContributor(context);
  if (!user) return json({ error: "Accès réservé aux contributeurs." }, 403);
  try {
    const body = await readBody(context.request);
    const id = cleanText(body.id,160);
    const title = cleanText(body.title,240);
    const type = types.has(body.type) ? body.type : "";
    const category = categories.has(body.category) ? body.category : "";
    const excerpt = cleanText(body.excerpt,600);
    const articleBody = cleanText(body.body,12000);
    const coverUrl = String(body.coverUrl || "").trim();
    const slug = title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,100);
    const now = new Date().toISOString();
    const existing = id ? await context.env.DB.prepare("SELECT id,status FROM contributor_submissions WHERE id=? AND owner_user_id=?").bind(id,user.sub).first() : null;
    if (id && !existing) return json({ error: "Brouillon introuvable." },404);
    if (existing && existing.status !== "draft") return json({ error: "Une proposition envoyée est verrouillée. Créez un nouveau contenu." },409);
    if (body.action === "delete") {
      if (!existing) return json({ error: "Brouillon introuvable." },404);
      await context.env.DB.prepare("DELETE FROM contributor_submissions WHERE id=? AND owner_user_id=? AND status='draft'").bind(id,user.sub).run();
      return json({ ok:true });
    }
    if (!type || !category || title.length < 5) return json({ error: "Choisissez un type et une rubrique, puis saisissez un titre d’au moins 5 caractères." },400);
    if (coverUrl && !/^\/media\/[a-z0-9-]{8,160}\.jpg$/i.test(coverUrl)) return json({ error: "Utilisez une image JPEG importée dans TAMUSNI." },400);
    const sources = Array.isArray(body.sources) ? body.sources.slice(0,10).map(source => ({label:cleanText(source?.label,160),url:cleanUrl(source?.url),publisher:cleanText(source?.publisher,120),note:cleanText(source?.note,500)})).filter(source => source.label && source.url) : [];
    if (body.action === "submit") {
      const missing = [];
      if (title.length < 12) missing.push("un titre précis d’au moins 12 caractères");
      if (!type) missing.push("un format");
      if (!category) missing.push("une rubrique");
      if (excerpt.length < 60) missing.push("un chapô d’au moins 60 caractères");
      if (articleBody.length < (type === "brief" ? 250 : 900)) missing.push(type === "brief" ? "une brève d’au moins 250 caractères" : "un article d’au moins 900 caractères");
      if (!coverUrl) missing.push("une image de couverture");
      if (!sources.length) missing.push("au moins une source HTTPS");
      if (missing.length) return json({error:`Impossible d’envoyer : ajoutez ${missing.join(", ")}.`},400);
      const imageKey = coverUrl.slice("/media/".length);
      const image = await context.env.DB.prepare("SELECT 1 AS found FROM editorial_media WHERE media_key=? AND content_type='image/jpeg'").bind(imageKey).first();
      if (!image) return json({error:"L’image de couverture n’est plus disponible. Importez-la à nouveau."},400);
    }
    const nextStatus = body.action === "submit" ? "submitted" : "draft";
    const submissionId = id || crypto.randomUUID();
    if (existing) {
      const update=await context.env.DB.prepare("UPDATE contributor_submissions SET type=?,category=?,title=?,slug=?,excerpt=?,body=?,cover_url=?,status=?,review_reason=NULL,updated_at=?,submitted_at=? WHERE id=? AND owner_user_id=? AND status='draft'").bind(type,category,title,slug,excerpt,articleBody,coverUrl||null,nextStatus,now,nextStatus==='submitted'?now:null,submissionId,user.sub).run();
      if(Number(update.meta?.changes||0)===0)return json({error:"Ce brouillon vient d’être verrouillé. Rechargez votre liste."},409);
    } else {
      await context.env.DB.prepare("INSERT INTO contributor_submissions(id,owner_user_id,type,category,title,slug,excerpt,body,cover_url,status,created_at,updated_at,submitted_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(submissionId,user.sub,type,category,title,slug,excerpt,articleBody,coverUrl||null,nextStatus,now,now,nextStatus==='submitted'?now:null).run();
    }
    if (existing) await context.env.DB.prepare("DELETE FROM contributor_submission_sources WHERE submission_id=?").bind(submissionId).run();
    if (sources.length) await context.env.DB.batch(sources.map(source=>context.env.DB.prepare("INSERT INTO contributor_submission_sources(id,submission_id,label,url,publisher,note,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),submissionId,source.label,source.url,source.publisher,source.note,now)));
    if (nextStatus === "submitted") await context.env.DB.prepare("INSERT INTO admin_notifications(id,type,title,body,target_url,target_type,target_id,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),"submission","Nouvelle proposition à valider",`${title} · ${user.name}`,"/admin/#validation","submission",submissionId,now).run();
    return json({ok:true,id:submissionId,status:nextStatus},existing?200:201);
  } catch (error) {
    return json({error:error?.message==="PAYLOAD_TOO_LARGE"?"Le contenu dépasse la taille autorisée.":"Enregistrement impossible pour le moment."},400);
  }
}

import { cleanText, json, readBody, requireAdmin, sameOrigin } from "../../_lib/auth.js";

const slugify=value=>cleanText(value,220).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,120);

export async function onRequestGet(context) {
  if(!await requireAdmin(context)) return json({error:"Accès réservé à l’administration."},403);
  const id=cleanText(new URL(context.request.url).searchParams.get("id"),160);
  if(id) {
    const item=await context.env.DB.prepare("SELECT s.*,u.name AS author_name,u.email AS author_email FROM contributor_submissions s LEFT JOIN users u ON u.id=s.owner_user_id WHERE s.id=?").bind(id).first();
    if(!item)return json({error:"Proposition introuvable."},404);
    const sources=await context.env.DB.prepare("SELECT label,url,publisher,note FROM contributor_submission_sources WHERE submission_id=? ORDER BY created_at").bind(id).all();
    return json({item,sources:sources.results||[]});
  }
  const status=new URL(context.request.url).searchParams.get("status");
  const result=status==="all"
    ? await context.env.DB.prepare("SELECT s.id,s.type,s.category,s.title,s.status,s.created_at,s.submitted_at,s.reviewed_at,s.review_reason,u.name AS author_name FROM contributor_submissions s LEFT JOIN users u ON u.id=s.owner_user_id ORDER BY COALESCE(s.submitted_at,s.updated_at) DESC LIMIT 200").all()
    : await context.env.DB.prepare("SELECT s.id,s.type,s.category,s.title,s.status,s.created_at,s.submitted_at,u.name AS author_name FROM contributor_submissions s LEFT JOIN users u ON u.id=s.owner_user_id WHERE s.status='submitted' ORDER BY s.submitted_at ASC LIMIT 100").all();
  return json({items:result.results||[]});
}

export async function onRequestPost(context) {
  if(!sameOrigin(context.request))return json({error:"Origine refusée."},403);
  const admin=await requireAdmin(context);if(!admin)return json({error:"Accès réservé à l’administration."},403);
  const body=await readBody(context.request);const id=cleanText(body.id,160);const action=body.action;const now=new Date().toISOString();
  if(!id||!['approve','reject'].includes(action))return json({error:"Action invalide."},400);
  const submission=await context.env.DB.prepare("SELECT s.*,u.name AS author_name FROM contributor_submissions s LEFT JOIN users u ON u.id=s.owner_user_id WHERE s.id=?").bind(id).first();
  if(!submission)return json({error:"Proposition introuvable."},404);
  if(submission.status!=="submitted")return json({error:"Cette proposition a déjà été traitée ou n’est plus en attente."},409);
  if(action==="reject") {
    const reason=cleanText(body.reason,1000);if(reason.length<5)return json({error:"Un motif de refus d’au moins 5 caractères est obligatoire."},400);
    const result=await context.env.DB.prepare("UPDATE contributor_submissions SET status='rejected',review_reason=?,reviewed_at=?,reviewed_by=?,updated_at=? WHERE id=? AND status='submitted'").bind(reason,now,admin.sub,now,id).run();
    if(Number(result.meta?.changes||0)===0)return json({error:"Cette proposition a déjà été traitée."},409);
    await context.env.DB.prepare("INSERT INTO admin_audit_log(id,admin_user_id,action,target_type,target_id,metadata,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),admin.sub,"submission.reject","submission",id,JSON.stringify({reason}),now).run();
    return json({ok:true,status:"rejected"});
  }
  const sources=await context.env.DB.prepare("SELECT id,label,url,publisher FROM contributor_submission_sources WHERE submission_id=? ORDER BY created_at").bind(id).all();
  if(submission.title.length<12||submission.excerpt.length<60||submission.body.length<(submission.type==='brief'?250:900)||!submission.cover_url||!sources.results?.length)return json({error:"La proposition est incomplète. Elle doit avoir un titre et un chapô précis, un texte suffisant, une image et au moins une source."},400);
  const mediaKey=submission.cover_url.replace(/^\/media\//,"");
  const media=await context.env.DB.prepare("SELECT 1 AS found FROM editorial_media WHERE media_key=? AND content_type='image/jpeg'").bind(mediaKey).first();
  if(!media)return json({error:"Image introuvable. La proposition ne peut pas être publiée."},400);
  const slug=`${slugify(submission.title)||'tamusni-contenu'}-${crypto.randomUUID().slice(0,8)}`;
  const contentId=crypto.randomUUID();const title=cleanText(submission.title,240);const author=cleanText(submission.author_name,100)||"Contributeur TAMUSNI";
  const statements=[context.env.DB.prepare("INSERT INTO content_items(id,slug,type,status,title,excerpt,body,summary,category,author_name,cover_url,fact_check_status,published_at,created_at,updated_at,submitted_by_user_id) SELECT ?,?,?,'published',?,?,?,?,?,?,?,'context',?,?,?,? WHERE EXISTS(SELECT 1 FROM contributor_submissions WHERE id=? AND status='submitted')").bind(contentId,slug,submission.type,title,cleanText(submission.excerpt,600),submission.body,cleanText(submission.excerpt,600),submission.category,author,submission.cover_url,now,now,now,submission.owner_user_id,id)];
  for(const source of sources.results)statements.push(context.env.DB.prepare("INSERT INTO content_sources(id,content_id,label,url,publisher,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM contributor_submissions WHERE id=? AND status='submitted')").bind(crypto.randomUUID(),contentId,source.label,source.url,source.publisher||"",now,id));
  statements.push(context.env.DB.prepare("UPDATE contributor_submissions SET status='approved',published_content_id=?,reviewed_at=?,reviewed_by=?,updated_at=? WHERE id=? AND status='submitted'").bind(contentId,now,admin.sub,now,id));
  try { const results=await context.env.DB.batch(statements);if(Number(results[0]?.meta?.changes||0)===0)return json({error:"Cette proposition a déjà été traitée."},409); } catch(error) { console.error("submission_publication_failed",error); return json({error:"Publication impossible. Vérifiez que l’URL de l’article est disponible."},409); }
  await context.env.DB.prepare("INSERT INTO admin_audit_log(id,admin_user_id,action,target_type,target_id,metadata,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),admin.sub,"submission.approve","content",contentId,JSON.stringify({submissionId:id,slug}),now).run();
  return json({ok:true,status:"approved",contentId,slug,url:`/articles/${slug}/`},201);
}

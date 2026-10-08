import { cleanText, hashPassword, json, readBody, requireAdmin, sameOrigin, validEmail } from "../../_lib/auth.js";

const topics = new Set(["Intelligence artificielle", "Innovation", "Robotique", "Cybersécurité", "Espace"]);
const audit = async (context, admin, action, targetId, metadata = {}) => context.env.DB.prepare("INSERT INTO admin_audit_log(id,admin_user_id,action,target_type,target_id,metadata,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),admin.sub,action,"user",targetId,JSON.stringify(metadata),new Date().toISOString()).run();

export async function onRequestGet(context) {
  if (!await requireAdmin(context)) return json({ error:"Accès réservé à l’administration." },403);
  const id=cleanText(new URL(context.request.url).searchParams.get("id"),160);
  if(id){
    const user=await context.env.DB.prepare("SELECT u.id,u.name,u.email,CASE WHEN u.role='ADMIN' THEN 'ADMIN' WHEN r.role='CONTRIBUTOR' THEN 'CONTRIBUTOR' ELSE 'USER' END AS role,u.is_banned,u.avatar_url,u.bio,u.preferred_topic,u.preferred_language,u.preferred_theme,u.text_size,u.display_density,u.notifications_enabled,u.terms_accepted_at,u.sponsored_in_app,u.sponsored_email,u.mfa_enabled,u.created_at FROM users u LEFT JOIN user_roles r ON r.user_id=u.id WHERE u.id=?").bind(id).first();
    if(!user)return json({error:"Compte introuvable."},404);
    const [saved,history,searches,subscriptions,reactions,comments,events]=await Promise.all([
      context.env.DB.prepare("SELECT item_type,title,url,created_at FROM saved_items WHERE user_id=? ORDER BY created_at DESC LIMIT 20").bind(id).all(),
      context.env.DB.prepare("SELECT h.progress,h.last_read_at,c.title,c.slug FROM reading_history h LEFT JOIN content_items c ON c.id=h.content_id WHERE h.user_id=? ORDER BY h.last_read_at DESC LIMIT 20").bind(id).all(),
      context.env.DB.prepare("SELECT query,searched_at FROM search_history WHERE user_id=? ORDER BY searched_at DESC LIMIT 20").bind(id).all(),
      context.env.DB.prepare("SELECT topic,created_at FROM topic_subscriptions WHERE user_id=? ORDER BY created_at DESC LIMIT 20").bind(id).all(),
      context.env.DB.prepare("SELECT r.reaction,r.created_at,c.title,c.slug FROM reactions r LEFT JOIN content_items c ON c.id=r.content_id WHERE r.user_id=? ORDER BY r.created_at DESC LIMIT 20").bind(id).all(),
      context.env.DB.prepare("SELECT body,status,created_at FROM comments WHERE user_id=? ORDER BY created_at DESC LIMIT 20").bind(id).all(),
      context.env.DB.prepare("SELECT event,country,suspicious,created_at FROM auth_events WHERE user_id=? ORDER BY created_at DESC LIMIT 20").bind(id).all()
    ]);
    return json({user,saved:saved.results||[],history:history.results||[],searches:searches.results||[],subscriptions:subscriptions.results||[],reactions:reactions.results||[],comments:comments.results||[],events:events.results||[]});
  }
  const result = await context.env.DB.prepare("SELECT u.id,u.name,u.email,CASE WHEN u.role='ADMIN' THEN 'ADMIN' WHEN r.role='CONTRIBUTOR' THEN 'CONTRIBUTOR' ELSE 'USER' END AS role,u.is_banned,u.preferred_topic,u.sponsored_in_app,u.sponsored_email,u.created_at FROM users u LEFT JOIN user_roles r ON r.user_id=u.id ORDER BY u.created_at DESC LIMIT 200").all();
  return json({ items:result.results||[] });
}

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error:"Origine refusée." },403);
  const admin=await requireAdmin(context); if(!admin)return json({error:"Accès réservé à l’administration."},403);
  const body=await readBody(context.request); const name=cleanText(body.name,80); const email=cleanText(body.email,254).toLowerCase(); const password=String(body.password||""); const preferredTopic=topics.has(body.preferredTopic)?body.preferredTopic:null; const role=body.role==="CONTRIBUTOR"?"CONTRIBUTOR":"USER";
  if(name.length<2||!validEmail(email)||password.length<6||!preferredTopic)return json({error:"Nom, e-mail, mot de passe et rubrique sont obligatoires."},400);
  const id=crypto.randomUUID(), now=new Date().toISOString();
  try {
    await context.env.DB.prepare("INSERT INTO users(id,name,email,password_hash,role,created_at,preferred_topic,sponsored_in_app,sponsored_email) VALUES(?,?,?,?,?,?,?,?,?)").bind(id,name,email,await hashPassword(password),"USER",now,preferredTopic,body.sponsoredInApp?1:0,body.sponsoredEmail?1:0).run();
    if(role==="CONTRIBUTOR") await context.env.DB.prepare("INSERT INTO user_roles(user_id,role,assigned_by,assigned_at) VALUES(?,'CONTRIBUTOR',?,?)").bind(id,admin.sub,now).run();
    await audit(context,admin,"user.create",id,{email,role}); return json({ok:true,id,role},201);
  } catch { return json({error:"Cette adresse e-mail est déjà utilisée."},409); }
}

export async function onRequestPatch(context) {
  if(!sameOrigin(context.request))return json({error:"Origine refusée."},403);
  const admin=await requireAdmin(context);if(!admin)return json({error:"Accès réservé à l’administration."},403);
  const body=await readBody(context.request);const id=cleanText(body.id,160);if(!id||id===admin.sub)return json({error:"Modification interdite."},400);
  const target=await context.env.DB.prepare("SELECT id,role FROM users WHERE id=?").bind(id).first();if(!target)return json({error:"Compte introuvable."},404);
  const currentRole=target.role==="ADMIN"?"ADMIN":(await context.env.DB.prepare("SELECT role FROM user_roles WHERE user_id=?").bind(id).first())?.role||"USER";
  if(body.action==="password") { if(currentRole!=="CONTRIBUTOR")return json({error:"Cette action est réservée aux comptes contributeurs."},400); const password=String(body.password||""); if(password.length<6||password.length>128)return json({error:"Le mot de passe doit contenir entre 6 et 128 caractères."},400); await context.env.DB.prepare("UPDATE users SET password_hash=? WHERE id=?").bind(await hashPassword(password),id).run(); await audit(context,admin,"user.password.reset",id); return json({ok:true}); }
  if(body.action==="ban"||body.action==="unban"){if(target.role==="ADMIN")return json({error:"Un compte administrateur ne peut pas être suspendu ici."},400);const isBanned=body.action==="ban"?1:0;await context.env.DB.prepare("UPDATE users SET is_banned=? WHERE id=?").bind(isBanned,id).run();await audit(context,admin,isBanned?"user.ban":"user.unban",id);return json({ok:true,is_banned:isBanned});}
  if(body.action==="update"){if(target.role==="ADMIN")return json({error:"La modification d’un autre administrateur est interdite."},400);const name=cleanText(body.name,80);const email=cleanText(body.email,254).toLowerCase();const preferredTopic=topics.has(body.preferredTopic)?body.preferredTopic:null;if(name.length<2||!validEmail(email)||!preferredTopic)return json({error:"Informations de compte invalides."},400);try{await context.env.DB.prepare("UPDATE users SET name=?,email=?,preferred_topic=?,sponsored_in_app=?,sponsored_email=? WHERE id=?").bind(name,email,preferredTopic,body.sponsoredInApp?1:0,body.sponsoredEmail?1:0,id).run();await audit(context,admin,"user.update",id,{email});return json({ok:true});}catch{return json({error:"Cette adresse e-mail est déjà utilisée."},409)}}
  const role=body.role==="CONTRIBUTOR"?"CONTRIBUTOR":"USER";if(currentRole==="ADMIN")return json({error:"La modification d’un autre administrateur est interdite."},400);
  if(role==="CONTRIBUTOR") await context.env.DB.prepare("INSERT INTO user_roles(user_id,role,assigned_by,assigned_at) VALUES(?,'CONTRIBUTOR',?,?) ON CONFLICT(user_id) DO UPDATE SET role='CONTRIBUTOR',assigned_by=excluded.assigned_by,assigned_at=excluded.assigned_at").bind(id,admin.sub,new Date().toISOString()).run();
  else await context.env.DB.prepare("DELETE FROM user_roles WHERE user_id=?").bind(id).run();
  await audit(context,admin,"user.role",id,{role});return json({ok:true,role});
}

export async function onRequestDelete(context) {
  if(!sameOrigin(context.request))return json({error:"Origine refusée."},403);
  const admin=await requireAdmin(context);if(!admin)return json({error:"Accès réservé à l’administration."},403);
  const body=await readBody(context.request);const id=cleanText(body.id,160);if(!id||id===admin.sub)return json({error:"Suppression interdite."},400);
  const target=await context.env.DB.prepare("SELECT id,role,email FROM users WHERE id=?").bind(id).first();if(!target)return json({error:"Compte introuvable."},404);if(target.role==="ADMIN")return json({error:"Un compte administrateur ne peut pas être supprimé ici."},400);
  await context.env.DB.prepare("INSERT INTO admin_notifications(id,type,title,body,target_url,target_type,target_id,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),"account","Compte supprimé","Une suppression définitive a été confirmée dans l’administration.","/admin/#accounts","user",id,new Date().toISOString()).run();
  await context.env.DB.prepare("DELETE FROM users WHERE id=?").bind(id).run();await audit(context,admin,"user.delete",id,{email:target.email});return json({ok:true});
}

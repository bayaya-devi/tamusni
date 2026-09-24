import { json, readBody, requireRecentSession, requireSession, sameOrigin } from "../../_lib/auth.js";
import { decryptMfaSecret, encryptMfaSecret, generateMfaSecret, verifyTotp } from "../../_lib/mfa.js";

export async function onRequestGet(context) {
  const session=await requireSession(context); if(!session)return json({error:"Connexion requise."},401);
  const [user,events]=await Promise.all([
    context.env.DB.prepare("SELECT mfa_enabled FROM users WHERE id=?").bind(session.sub).first(),
    context.env.DB.prepare("SELECT event,country,suspicious,created_at FROM auth_events WHERE user_id=? ORDER BY created_at DESC LIMIT 15").bind(session.sub).all()
  ]);
  return json({enabled:Boolean(user?.mfa_enabled),events:events.results||[]});
}

export async function onRequestPost(context) {
  if(!sameOrigin(context.request))return json({error:"Origine refusée."},403); const session=await requireRecentSession(context);if(!session)return json({error:"Reconnectez-vous avant de modifier la double authentification."},403);
  if(!context.env.SESSION_SECRET)return json({error:"Configuration de sécurité indisponible."},503);
  const secret=generateMfaSecret(); const encrypted=await encryptMfaSecret(secret,context.env.SESSION_SECRET);
  await context.env.DB.prepare("UPDATE users SET mfa_pending_secret=? WHERE id=?").bind(encrypted,session.sub).run();
  const label=encodeURIComponent(`TAMUSNI:${session.email}`); const uri=`otpauth://totp/${label}?secret=${secret}&issuer=TAMUSNI&algorithm=SHA1&digits=6&period=30`;
  return json({ok:true,secret,uri});
}

export async function onRequestPatch(context) {
  if(!sameOrigin(context.request))return json({error:"Origine refusée."},403); const session=await requireRecentSession(context);if(!session)return json({error:"Reconnectez-vous avant de modifier la double authentification."},403);
  const {code}=await readBody(context.request); const user=await context.env.DB.prepare("SELECT mfa_pending_secret FROM users WHERE id=?").bind(session.sub).first();
  if(!user?.mfa_pending_secret)return json({error:"Commencez d’abord la configuration."},400);
  try{const secret=await decryptMfaSecret(user.mfa_pending_secret,context.env.SESSION_SECRET);if(!await verifyTotp(secret,code))return json({error:"Code incorrect."},400);const now=new Date().toISOString();await context.env.DB.prepare("UPDATE users SET mfa_enabled=1,mfa_secret=mfa_pending_secret,mfa_pending_secret=NULL WHERE id=?").bind(session.sub).run();await context.env.DB.prepare("INSERT INTO notifications(id,user_id,title,url,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),session.sub,"Double authentification activée","/compte/",now).run();return json({ok:true,enabled:true})}catch{return json({error:"Configuration expirée ou invalide."},400)}
}

export async function onRequestDelete(context) {
  if(!sameOrigin(context.request))return json({error:"Origine refusée."},403); const session=await requireRecentSession(context);if(!session)return json({error:"Reconnectez-vous avant de modifier la double authentification."},403);
  const {code}=await readBody(context.request); const user=await context.env.DB.prepare("SELECT mfa_enabled,mfa_secret FROM users WHERE id=?").bind(session.sub).first();
  if(!user?.mfa_enabled||!user.mfa_secret)return json({error:"La double authentification n’est pas active."},400);
  try{const secret=await decryptMfaSecret(user.mfa_secret,context.env.SESSION_SECRET);if(!await verifyTotp(secret,code))return json({error:"Code incorrect."},400);await context.env.DB.prepare("UPDATE users SET mfa_enabled=0,mfa_secret=NULL,mfa_pending_secret=NULL WHERE id=?").bind(session.sub).run();return json({ok:true,enabled:false})}catch{return json({error:"Désactivation impossible."},400)}
}

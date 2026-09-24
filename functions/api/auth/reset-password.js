import { hashPassword, hashToken, json, readBody, sameOrigin } from "../../_lib/auth.js";

export async function onRequestPost(context){
  if(!sameOrigin(context.request))return json({error:"Origine refusée."},403);
  try{const body=await readBody(context.request);const token=String(body.token||"");const password=String(body.password||"");if(token.length<20||password.length<6||password.length>128)return json({error:"Lien ou mot de passe invalide."},400);const tokenHash=await hashToken(token);const found=await context.env.DB.prepare("SELECT user_id FROM password_reset_tokens WHERE token_hash=? AND expires_at>? LIMIT 1").bind(tokenHash,new Date().toISOString()).first();if(!found)return json({error:"Ce lien est invalide ou expiré."},400);await context.env.DB.batch([context.env.DB.prepare("UPDATE users SET password_hash=? WHERE id=?").bind(await hashPassword(password),found.user_id),context.env.DB.prepare("DELETE FROM password_reset_tokens WHERE token_hash=?").bind(tokenHash)]);return json({ok:true,redirect:"/connexion/"})}catch(error){console.error("reset_password_failed",error);return json({error:"Réinitialisation impossible."},500)}
}

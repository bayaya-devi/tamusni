import { hashToken, json, readBody, sameOrigin, validEmail } from "../../_lib/auth.js";
import { emailLayout, emailProvider, escapeHtml, sendEmail } from "../../_lib/email.js";

const GENERIC_MESSAGE="Si ce compte existe et reste à confirmer, un nouvel e-mail vient d’être envoyé.";

export async function onRequestPost(context){
  if(!sameOrigin(context.request))return json({error:"Origine refusée."},403);
  try{
    const body=await readBody(context.request),email=String(body.email||"").trim().toLowerCase(),locale=["fr","ar","en","es","pt"].includes(body.locale)?body.locale:"fr";
    if(!validEmail(email))return json({ok:true,message:GENERIC_MESSAGE});
    if(!emailProvider(context.env))return json({error:"Le service de confirmation e-mail est momentanément indisponible."},503);
    const user=await context.env.DB.prepare("SELECT id,name,email_verified_at FROM users WHERE email=?").bind(email).first();
    if(!user||user.email_verified_at)return json({ok:true,message:GENERIC_MESSAGE});
    const latest=await context.env.DB.prepare("SELECT created_at FROM email_verification_tokens WHERE user_id=? ORDER BY created_at DESC LIMIT 1").bind(user.id).first();
    if(latest&&Date.now()-Date.parse(latest.created_at)<10*60_000)return json({ok:true,message:GENERIC_MESSAGE});
    const now=new Date().toISOString(),bytes=crypto.getRandomValues(new Uint8Array(32)),token=btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
    await context.env.DB.batch([
      context.env.DB.prepare("DELETE FROM email_verification_tokens WHERE user_id=?").bind(user.id),
      context.env.DB.prepare("INSERT INTO email_verification_tokens(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)").bind(await hashToken(token),user.id,new Date(Date.now()+24*60*60_000).toISOString(),now)
    ]);
    const verifyUrl=`${new URL(context.request.url).origin}/api/auth/verify-email?token=${encodeURIComponent(token)}&locale=${locale}`;
    await sendEmail(context.env,{to:email,subject:"Confirmez votre adresse e-mail TAMUSNI",html:emailLayout("Confirmez votre adresse e-mail",`<p>Bonjour ${escapeHtml(user.name)},</p><p><a href="${verifyUrl}">Confirmer mon adresse e-mail</a></p><p>Ce lien expire dans 24 heures.</p>`),text:`Confirmez votre adresse e-mail TAMUSNI : ${verifyUrl}`});
    return json({ok:true,message:GENERIC_MESSAGE});
  }catch(error){console.error("resend_verification_failed",error);return json({error:"Impossible de renvoyer l’e-mail pour le moment."},500)}
}

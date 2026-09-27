import { hashToken, json, readBody, sameOrigin, validEmail } from "../../_lib/auth.js";
import { emailLayout, emailProvider, escapeHtml, sendEmail } from "../../_lib/email.js";

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  if (!emailProvider(context.env)) return json({ error: "Le service d’e-mail doit encore être activé par l’administrateur." }, 503);
  try {
    const { email: rawEmail } = await readBody(context.request); const email = String(rawEmail || "").trim().toLowerCase();
    if (!validEmail(email)) return json({ error: "Adresse e-mail invalide." }, 400);
    const user = await context.env.DB.prepare("SELECT id,name,email FROM users WHERE email = ? LIMIT 1").bind(email).first();
    if (user) {
      const bytes = crypto.getRandomValues(new Uint8Array(32)); const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
      await context.env.DB.prepare("DELETE FROM password_reset_tokens WHERE user_id = ?").bind(user.id).run();
      await context.env.DB.prepare("INSERT INTO password_reset_tokens (token_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)").bind(await hashToken(token),user.id,new Date(Date.now()+30*60_000).toISOString(),new Date().toISOString()).run();
      const resetUrl=`${new URL(context.request.url).origin}/reinitialiser-mot-de-passe/?token=${encodeURIComponent(token)}`;
      await sendEmail(context.env,{to:user.email,subject:"Réinitialisez votre mot de passe TAMUSNI",html:emailLayout("Réinitialisez votre mot de passe",`<p>Bonjour ${escapeHtml(user.name)},</p><p><a href="${resetUrl}">Choisir un nouveau mot de passe</a></p><p>Ce lien expire dans 30 minutes.</p>`),text:`Bonjour ${user.name}, choisissez un nouveau mot de passe : ${resetUrl}`});
    }
    return json({ok:true,message:"Si ce compte existe, un e-mail vient d’être envoyé."});
  } catch(error){console.error("forgot_password_failed",error);return json({error:"L’e-mail de réinitialisation n’a pas pu être envoyé."},502)}
}

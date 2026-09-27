import { hashToken, json, readBody, sameOrigin, validEmail } from "../_lib/auth.js";
import { mirrorNewsletter } from "../_lib/supabase.js";
import { emailLayout, emailProvider, sendEmail } from "../_lib/email.js";

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  try {
    const body = await readBody(context.request); const email = String(body.email || "").trim().toLowerCase(); const locale = String(body.locale || "fr").slice(0, 8);
    if (!validEmail(email)) return json({ error: "Adresse e-mail invalide." }, 400);
    if (!emailProvider(context.env)) return json({ error:"Le service d’e-mail doit encore être activé par l’administrateur." },503);
    const existing=await context.env.DB.prepare("SELECT email_verified_at FROM newsletter_subscribers WHERE email=?").bind(email).first();
    if(existing?.email_verified_at)return json({ok:true,message:"Cette adresse est déjà confirmée."});
    await context.env.DB.prepare("INSERT OR IGNORE INTO newsletter_subscribers (id, email, locale, created_at) VALUES (?, ?, ?, ?)").bind(crypto.randomUUID(), email, locale, new Date().toISOString()).run();
    try { const bytes=crypto.getRandomValues(new Uint8Array(32)); const token=btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""); const now=new Date().toISOString(); await context.env.DB.prepare("DELETE FROM newsletter_verification_tokens WHERE email=?").bind(email).run(); await context.env.DB.prepare("INSERT INTO newsletter_verification_tokens(token_hash,email,expires_at,created_at) VALUES(?,?,?,?)").bind(await hashToken(token),email,new Date(Date.now()+24*60*60_000).toISOString(),now).run(); const verifyUrl=`${new URL(context.request.url).origin}/api/newsletter/verify?token=${encodeURIComponent(token)}`; await sendEmail(context.env,{to:email,subject:"Confirmez votre abonnement à la revue TAMUSNI",html:emailLayout("Confirmez votre abonnement",`<p>Confirmez votre adresse pour recevoir la revue TAMUSNI.</p><p><a href="${verifyUrl}">Confirmer mon abonnement</a></p><p>Ce lien expire dans 24 heures.</p>`),text:`Confirmez votre abonnement : ${verifyUrl}`}); } catch(error) { await context.env.DB.prepare("DELETE FROM newsletter_verification_tokens WHERE email=?").bind(email).run(); if(!existing)await context.env.DB.prepare("DELETE FROM newsletter_subscribers WHERE email=?").bind(email).run(); throw error; }
    try { await mirrorNewsletter(context.env, email, locale); } catch (error) { console.error("supabase_newsletter_mirror_failed", error); }
    return json({ ok: true, message: "Vérifiez votre e-mail pour confirmer votre abonnement." }, 201);
  } catch (error) { const emailFailure=error?.message==="EMAIL_REJECTED"||error?.message==="EMAIL_NOT_CONFIGURED"; return json({ error: error?.message === "PAYLOAD_TOO_LARGE" ? "Requête trop volumineuse." : emailFailure ? "La confirmation e-mail n’a pas pu être envoyée. Aucun abonnement n’a été créé." : "Inscription impossible pour le moment." }, error?.message === "PAYLOAD_TOO_LARGE" ? 413 : emailFailure ? 502 : 500); }
}

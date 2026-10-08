import { createSessionCookie, hashPassword, hashToken, json, readBody, sameOrigin, validEmail } from "../../_lib/auth.js";
import { mirrorUser } from "../../_lib/supabase.js";
import { emailLayout, emailProvider, escapeHtml, sendEmail } from "../../_lib/email.js";
import { normalizeTopics, replaceTopicSubscriptions } from "../../_lib/topics.js";
import { finalizeNewsletterIntent } from "../../_lib/newsletter-service.js";

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  try {
    const body = await readBody(context.request); const firstName = String(body.firstName || "").trim(); const lastName = String(body.lastName || "").trim(); const name = String(body.name || `${firstName} ${lastName}`).trim(); const email = String(body.email || "").trim().toLowerCase(); const password = String(body.password || ""); const preferredTopics = normalizeTopics(body.preferredTopics, body.preferredTopic); const termsAccepted = body.termsAccepted === "on" || body.termsAccepted === true; const sponsoredInApp = body.sponsoredInApp === "on" || body.sponsoredInApp === true ? 1 : 0; const sponsoredEmail = body.sponsoredEmail === "on" || body.sponsoredEmail === true ? 1 : 0;
    if (name.length < 2 || !validEmail(email) || password.length < 6 || password.length > 128 || !preferredTopics.length || !termsAccepted) return json({ error: "Renseignez vos informations, choisissez au moins une rubrique et acceptez les conditions d’utilisation." }, 400);
    if (!emailProvider(context.env)) return json({ error: "La création de compte est momentanément indisponible : le service de confirmation e-mail n’est pas activé." }, 503);
    if (!context.env.SESSION_SECRET) return json({ error: "Configuration de session indisponible." }, 503);
    const existing = await context.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existing) return json({ error: "Un compte existe déjà avec cette adresse." }, 409);
    const now = new Date().toISOString(); const preferredTopic = preferredTopics[0]; const user = { id: crypto.randomUUID(), name, email, role: "USER", preferredTopic, termsAcceptedAt: now, sponsoredInApp, sponsoredEmail, created_at: now };
    await context.env.DB.batch([
      context.env.DB.prepare("INSERT INTO users (id,name,email,password_hash,role,created_at,preferred_topic,terms_accepted_at,sponsored_in_app,sponsored_email) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(user.id,name,email,await hashPassword(password),"USER",now,preferredTopic,now,sponsoredInApp,sponsoredEmail),
      ...preferredTopics.map(topic => context.env.DB.prepare("INSERT INTO topic_subscriptions(user_id,topic,created_at) VALUES(?,?,?)").bind(user.id, topic, now))
    ]);
    try {
      const bytes=crypto.getRandomValues(new Uint8Array(32)); const token=btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");
      await context.env.DB.prepare("DELETE FROM email_verification_tokens WHERE user_id=?").bind(user.id).run();
      await context.env.DB.prepare("INSERT INTO email_verification_tokens(token_hash,user_id,expires_at,created_at) VALUES(?,?,?,?)").bind(await hashToken(token),user.id,new Date(Date.now()+24*60*60_000).toISOString(),now).run();
      const verifyUrl=`${new URL(context.request.url).origin}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
      await sendEmail(context.env,{to:email,subject:"Confirmez votre adresse e-mail TAMUSNI",html:emailLayout("Confirmez votre adresse e-mail",`<p>Bonjour ${escapeHtml(name)},</p><p>Votre compte TAMUSNI est créé. <a href="${verifyUrl}">Confirmer mon adresse e-mail</a></p><p>Ce lien expire dans 24 heures.</p>`),text:`Bonjour ${name}, confirmez votre adresse e-mail : ${verifyUrl}`});
    } catch (error) { await context.env.DB.prepare("DELETE FROM users WHERE id=?").bind(user.id).run(); throw error; }
    try { await context.env.DB.prepare("INSERT INTO admin_notifications(id,type,title,body,target_url,target_type,target_id,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),"account","Nouveau compte","Un compte vient d’être créé.","/admin/#accounts","user",user.id,now).run(); } catch (error) { console.error("admin_notification_failed", error); }
    try { await mirrorUser(context.env, user); } catch (error) { console.error("supabase_user_mirror_failed", error); }
    try { await sendEmail(context.env,{to:context.env.ADMIN_NOTIFICATION_EMAIL||"aetbconseil@gmail.com",subject:"Nouveau compte TAMUSNI",html:emailLayout("Nouveau compte",`<p>${escapeHtml(name)} vient de créer un compte avec les rubriques : ${escapeHtml(preferredTopics.join(", "))}.</p>`),text:`Nouveau compte : ${name} (${preferredTopics.join(", ")}).`}); } catch (error) { console.error("admin_account_email_failed",error); }
    let newsletter=null;try{newsletter=await finalizeNewsletterIntent(context,user)}catch(error){console.error("newsletter_intent_finalize_failed",error)}
    return json({ ok: true, newsletter:newsletter&&!newsletter.mismatch?"subscribed":null,redirect: `/mon-espace/${newsletter&&!newsletter.mismatch?'?newsletter=success':''}`, message:"Compte créé. Un e-mail de confirmation vient d’être envoyé." }, 201, { "Set-Cookie": await createSessionCookie(user, context.env.SESSION_SECRET) });
  } catch (error) { console.error("registration_failed", error); const emailFailure=error?.message==="EMAIL_REJECTED"||error?.message==="EMAIL_NOT_CONFIGURED"; return json({ error: error?.message === "PAYLOAD_TOO_LARGE" ? "Requête trop volumineuse." : emailFailure ? "La confirmation e-mail n’a pas pu être envoyée. Aucun compte n’a été créé." : "Création du compte impossible." }, error?.message === "PAYLOAD_TOO_LARGE" ? 413 : emailFailure ? 502 : 500); }
}

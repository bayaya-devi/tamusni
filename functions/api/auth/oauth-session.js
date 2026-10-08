import { createMfaChallengeCookie, createSessionCookie, hashPassword, json, readBody, sameOrigin } from "../../_lib/auth.js";
import { mirrorUser } from "../../_lib/supabase.js";
import { recordAuthEvent } from "../../_lib/mfa.js";
import { normalizeTopics } from "../../_lib/topics.js";
import { finalizeNewsletterIntent } from "../../_lib/newsletter-service.js";

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  try {
    const body = await readBody(context.request); const accessToken = body.accessToken;
    const auth = await fetch(`${context.env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: context.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` } });
    if (!auth.ok) return json({ error: "Connexion sociale invalide." }, 401);
    const profile = await auth.json(); const email = String(profile.email || "").toLowerCase();
    if (!email) return json({ error: "Le fournisseur n’a pas transmis d’adresse e-mail." }, 400);
    let user = await context.env.DB.prepare("SELECT u.id,u.name,u.email,u.role,u.created_at,u.mfa_enabled,r.role AS additional_role FROM users u LEFT JOIN user_roles r ON r.user_id=u.id WHERE u.email=? LIMIT 1").bind(email).first();
    if (!user) {
      const firstName = String(body.firstName || "").trim(); const lastName = String(body.lastName || "").trim(); const preferredTopics = normalizeTopics(body.preferredTopics, body.preferredTopic); const termsAccepted = body.termsAccepted === "on" || body.termsAccepted === true; const sponsoredInApp = body.sponsoredInApp === "on" || body.sponsoredInApp === true ? 1 : 0; const sponsoredEmail = body.sponsoredEmail === "on" || body.sponsoredEmail === true ? 1 : 0;
      if (firstName.length < 2 || lastName.length < 2 || !preferredTopics.length || !termsAccepted) return json({ error: "Complétez votre profil, choisissez au moins une rubrique et acceptez les conditions pour terminer l’inscription Google." }, 400);
      const createdAt = new Date().toISOString(); const preferredTopic = preferredTopics[0]; user = { id: crypto.randomUUID(), name: `${firstName} ${lastName}`.trim(), email, role: "USER", mfa_enabled:0, preferredTopic, termsAcceptedAt: createdAt, sponsoredInApp, sponsoredEmail, created_at: createdAt };
      await context.env.DB.batch([
        context.env.DB.prepare("INSERT INTO users (id,name,email,password_hash,role,created_at,email_verified_at,preferred_topic,terms_accepted_at,sponsored_in_app,sponsored_email) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(user.id,user.name,email,await hashPassword(crypto.randomUUID()+crypto.randomUUID()),"USER",createdAt,createdAt,preferredTopic,createdAt,sponsoredInApp,sponsoredEmail),
        ...preferredTopics.map(topic => context.env.DB.prepare("INSERT INTO topic_subscriptions(user_id,topic,created_at) VALUES(?,?,?)").bind(user.id, topic, createdAt))
      ]);
    }
    try { await mirrorUser(context.env, user); } catch (error) { console.error("supabase_oauth_mirror_failed", error); }
    if(user.mfa_enabled)return json({ok:true,mfaRequired:true,message:"Saisissez le code de votre application d’authentification."},202,{"Set-Cookie":await createMfaChallengeCookie(user,context.env.SESSION_SECRET)});
    try{await recordAuthEvent(context,{userId:user.id,email:user.email,event:"oauth_success"})}catch{}
    const role=user.role === "ADMIN" ? "ADMIN" : user.additional_role || "USER";
    let newsletter=null;try{newsletter=await finalizeNewsletterIntent(context,user)}catch(error){console.error("newsletter_intent_finalize_failed",error)}
    return json({ ok: true, newsletter:newsletter&&!newsletter.mismatch?"subscribed":null,redirect: role === "ADMIN" ? "/admin/" : role === "CONTRIBUTOR" ? "/contributeur/" : `/mon-espace/${newsletter&&!newsletter.mismatch?'?newsletter=success':''}` }, 200, { "Set-Cookie": await createSessionCookie({ ...user, role }, context.env.SESSION_SECRET) });
  } catch (error) { console.error("oauth_session_failed", error); return json({ error: "Connexion sociale impossible." }, 500); }
}

import { createMfaChallengeCookie, createSessionCookie, json, readBody, sameOrigin } from "../../_lib/auth.js";
import { mirrorUser } from "../../_lib/supabase.js";
import { recordAuthEvent } from "../../_lib/mfa.js";
import { normalizeTopics, replaceTopicSubscriptions } from "../../_lib/topics.js";
import { cancelNewsletterIntent, finalizeNewsletterIntent } from "../../_lib/newsletter-service.js";

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  try {
    const body = await readBody(context.request); const accessToken = body.accessToken;
    const auth = await fetch(`${context.env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: context.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` } });
    if (!auth.ok) return json({ error: "Connexion sociale invalide." }, 401);
    const profile = await auth.json(); const email = String(profile.email || "").toLowerCase();
    if (!email || !(profile.email_confirmed_at || profile.confirmed_at)) return json({ error: "Le fournisseur n’a pas confirmé l’adresse e-mail." }, 400);
    if (!context.env.SESSION_SECRET) return json({ error: "Configuration de sécurité indisponible." }, 503);
    let user = await context.env.DB.prepare("SELECT u.id,u.name,u.email,u.role,u.created_at,u.mfa_enabled,u.is_banned,u.session_version,u.preferred_language,u.email_verified_at,r.role AS additional_role FROM users u LEFT JOIN user_roles r ON r.user_id=u.id WHERE u.email=? LIMIT 1").bind(email).first();
    if (!user) {
      const firstName = String(body.firstName || "").trim(); const lastName = String(body.lastName || "").trim(); const preferredTopics = normalizeTopics(body.preferredTopics, body.preferredTopic); const termsAccepted = body.termsAccepted === "on" || body.termsAccepted === true; const sponsoredInApp = body.sponsoredInApp === "on" || body.sponsoredInApp === true ? 1 : 0; const sponsoredEmail = body.sponsoredEmail === "on" || body.sponsoredEmail === true ? 1 : 0;
      if (firstName.length < 2 || lastName.length < 2 || !preferredTopics.length || !termsAccepted) return json({ error: "Complétez votre profil, choisissez au moins une rubrique et acceptez les conditions pour terminer l’inscription Google.", code:"OAUTH_PROFILE_REQUIRED" }, 400);
      const createdAt = new Date().toISOString(); const preferredTopic = preferredTopics[0]; user = { id: crypto.randomUUID(), name: `${firstName} ${lastName}`.trim(), email, role: "USER", mfa_enabled:0, session_version:1, preferred_language:String(body.locale||"fr"), preferredTopic, termsAcceptedAt: createdAt, sponsoredInApp, sponsoredEmail, created_at: createdAt };
      // A social-only account has no password to validate.  Persisting a
      // non-verifiable marker avoids an unnecessary expensive password hash
      // in the OAuth callback; a password reset can still create a password
      // later if the account owner chooses to use password sign-in.
      const oauthPasswordMarker = `oauth$${crypto.randomUUID()}`;
      await context.env.DB.prepare("INSERT INTO users (id,name,email,password_hash,role,created_at,email_verified_at,preferred_language,preferred_topic,terms_accepted_at,sponsored_in_app,sponsored_email,session_version) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(user.id,user.name,email,oauthPasswordMarker,"USER",createdAt,createdAt,user.preferred_language,preferredTopic,createdAt,sponsoredInApp,sponsoredEmail,1).run();
      await replaceTopicSubscriptions(context.env.DB, user.id, preferredTopics, createdAt);
    }
    else if(user.is_banned)return json({error:"Ce compte est suspendu. Contactez TAMUSNI si vous pensez qu’il s’agit d’une erreur."},403);
    else if(!user.email_verified_at){user.email_verified_at=new Date().toISOString();await context.env.DB.batch([context.env.DB.prepare("UPDATE users SET email_verified_at=? WHERE id=?").bind(user.email_verified_at,user.id),context.env.DB.prepare("DELETE FROM account_challenges WHERE user_id=? AND purpose='EMAIL_VERIFICATION'").bind(user.id)]);}
    try { await mirrorUser(context.env, user); } catch (error) { console.error("supabase_oauth_mirror_failed", error); }
    if(user.mfa_enabled)return json({ok:true,mfaRequired:true,message:"Saisissez le code de votre application d’authentification."},202,{"Set-Cookie":await createMfaChallengeCookie(user,context.env.SESSION_SECRET)});
    try{await recordAuthEvent(context,{userId:user.id,email:user.email,name:user.name,locale:user.preferred_language,event:"oauth_success"})}catch(error){console.error("auth_event_write_failed",error)}
    const role=user.role === "ADMIN" ? "ADMIN" : user.additional_role || "USER";
    const newsletterConsent=Object.prototype.hasOwnProperty.call(body,"newsletterConsent");let newsletter=null;try{if(body.newsletterConsent===true||body.newsletterConsent==="on")newsletter=await finalizeNewsletterIntent(context,user);else if(newsletterConsent)await cancelNewsletterIntent(context)}catch(error){console.error("newsletter_intent_finalize_failed",error)}
    return json({ ok: true, newsletter:newsletter&&!newsletter.mismatch?"subscribed":null,redirect: role === "ADMIN" ? "/admin/" : role === "CONTRIBUTOR" ? "/contributeur/" : `/mon-espace/${newsletter&&!newsletter.mismatch?'?newsletter=success':''}` }, 200, { "Set-Cookie": await createSessionCookie({ ...user, role }, context.env.SESSION_SECRET) });
  } catch (error) { console.error("oauth_session_failed", error); return json({ error: "Connexion sociale impossible." }, 500); }
}

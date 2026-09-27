import { createMfaChallengeCookie, createSessionCookie, hashPassword, json, readBody, sameOrigin } from "../../_lib/auth.js";
import { mirrorUser } from "../../_lib/supabase.js";
import { recordAuthEvent } from "../../_lib/mfa.js";

const topics = new Set(["Intelligence artificielle", "Innovation", "Robotique", "Cybersécurité", "Espace"]);

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  try {
    const body = await readBody(context.request); const accessToken = body.accessToken;
    const auth = await fetch(`${context.env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: context.env.SUPABASE_ANON_KEY, Authorization: `Bearer ${accessToken}` } });
    if (!auth.ok) return json({ error: "Connexion sociale invalide." }, 401);
    const profile = await auth.json(); const email = String(profile.email || "").toLowerCase();
    if (!email) return json({ error: "Le fournisseur n’a pas transmis d’adresse e-mail." }, 400);
    let user = await context.env.DB.prepare("SELECT id,name,email,role,created_at,mfa_enabled FROM users WHERE email=? LIMIT 1").bind(email).first();
    if (!user) {
      const firstName = String(body.firstName || "").trim(); const lastName = String(body.lastName || "").trim(); const preferredTopic = topics.has(body.preferredTopic) ? body.preferredTopic : null; const termsAccepted = body.termsAccepted === "on" || body.termsAccepted === true; const sponsoredInApp = body.sponsoredInApp === "on" || body.sponsoredInApp === true ? 1 : 0; const sponsoredEmail = body.sponsoredEmail === "on" || body.sponsoredEmail === true ? 1 : 0;
      if (firstName.length < 2 || lastName.length < 2 || !preferredTopic || !termsAccepted) return json({ error: "Complétez votre profil, choisissez une rubrique et acceptez les conditions pour terminer l’inscription Google." }, 400);
      const createdAt = new Date().toISOString(); user = { id: crypto.randomUUID(), name: `${firstName} ${lastName}`.trim(), email, role: "USER", mfa_enabled:0, preferredTopic, termsAcceptedAt: createdAt, sponsoredInApp, sponsoredEmail, created_at: createdAt };
      await context.env.DB.prepare("INSERT INTO users (id,name,email,password_hash,role,created_at,email_verified_at,preferred_topic,terms_accepted_at,sponsored_in_app,sponsored_email) VALUES (?,?,?,?,?,?,?,?,?,?,?)").bind(user.id,user.name,email,await hashPassword(crypto.randomUUID()+crypto.randomUUID()),"USER",createdAt,createdAt,preferredTopic,createdAt,sponsoredInApp,sponsoredEmail).run();
    }
    try { await mirrorUser(context.env, user); } catch (error) { console.error("supabase_oauth_mirror_failed", error); }
    if(user.mfa_enabled)return json({ok:true,mfaRequired:true,message:"Saisissez le code de votre application d’authentification."},202,{"Set-Cookie":await createMfaChallengeCookie(user,context.env.SESSION_SECRET)});
    try{await recordAuthEvent(context,{userId:user.id,email:user.email,event:"oauth_success"})}catch{}
    return json({ ok: true, redirect: user.role === "ADMIN" ? "/admin/" : "/mon-espace/" }, 200, { "Set-Cookie": await createSessionCookie(user, context.env.SESSION_SECRET) });
  } catch (error) { console.error("oauth_session_failed", error); return json({ error: "Connexion sociale impossible." }, 500); }
}

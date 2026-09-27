import { createSessionCookie, hashPassword, json, readBody, sameOrigin, validEmail } from "../../_lib/auth.js";
import { mirrorUser } from "../../_lib/supabase.js";

const topics = new Set(["Intelligence artificielle", "Innovation", "Robotique", "Cybersécurité", "Espace"]);

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  try {
    const body = await readBody(context.request); const firstName = String(body.firstName || "").trim(); const lastName = String(body.lastName || "").trim(); const name = String(body.name || `${firstName} ${lastName}`).trim(); const email = String(body.email || "").trim().toLowerCase(); const password = String(body.password || ""); const preferredTopic = topics.has(body.preferredTopic) ? body.preferredTopic : null; const termsAccepted = body.termsAccepted === "on" || body.termsAccepted === true; const sponsoredInApp = body.sponsoredInApp === "on" || body.sponsoredInApp === true ? 1 : 0; const sponsoredEmail = body.sponsoredEmail === "on" || body.sponsoredEmail === true ? 1 : 0;
    if (name.length < 2 || !validEmail(email) || password.length < 6 || password.length > 128 || !preferredTopic || !termsAccepted) return json({ error: "Renseignez vos informations, votre rubrique préférée et acceptez les conditions d’utilisation." }, 400);
    const existing = await context.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existing) return json({ error: "Un compte existe déjà avec cette adresse." }, 409);
    const now = new Date().toISOString(); const user = { id: crypto.randomUUID(), name, email, role: "USER", preferredTopic, termsAcceptedAt: now, sponsoredInApp, sponsoredEmail, created_at: now };
    await context.env.DB.prepare("INSERT INTO users (id,name,email,password_hash,role,created_at,preferred_topic,terms_accepted_at,sponsored_in_app,sponsored_email) VALUES (?,?,?,?,?,?,?,?,?,?)").bind(user.id,name,email,await hashPassword(password),"USER",now,preferredTopic,now,sponsoredInApp,sponsoredEmail).run();
    try { await context.env.DB.prepare("INSERT INTO admin_notifications(id,type,title,body,target_url,target_type,target_id,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),"account","Nouveau compte","Un compte vient d’être créé.","/admin/#accounts","user",user.id,now).run(); } catch (error) { console.error("admin_notification_failed", error); }
    try { await mirrorUser(context.env, user); } catch (error) { console.error("supabase_user_mirror_failed", error); }
    if (!context.env.SESSION_SECRET) return json({ error: "Configuration de session indisponible." }, 503);
    return json({ ok: true, redirect: "/mon-espace/" }, 201, { "Set-Cookie": await createSessionCookie(user, context.env.SESSION_SECRET) });
  } catch (error) { console.error("registration_failed", error); return json({ error: error?.message === "PAYLOAD_TOO_LARGE" ? "Requête trop volumineuse." : "Création du compte impossible." }, error?.message === "PAYLOAD_TOO_LARGE" ? 413 : 500); }
}

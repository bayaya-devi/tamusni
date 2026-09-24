import { createSessionCookie, json, readBody, sameOrigin, validEmail, verifyPassword } from "../../_lib/auth.js";
import { mirrorUser } from "../../_lib/supabase.js";

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  try {
    const body = await readBody(context.request); const email = String(body.email || "").trim().toLowerCase(); const password = String(body.password || "");
    if (!validEmail(email) || password.length < 6) return json({ error: "Identifiants invalides." }, 401);
    const user = await context.env.DB.prepare("SELECT id, name, email, password_hash, role FROM users WHERE email = ?").bind(email).first();
    if (!user || !(await verifyPassword(password, user.password_hash))) return json({ error: "Identifiants invalides." }, 401);
    try { await mirrorUser(context.env, user); } catch (error) { console.error("supabase_user_mirror_failed", error); }
    if (!context.env.SESSION_SECRET) return json({ error: "Configuration de session indisponible." }, 503);
    return json({ ok: true, redirect: user.role === "ADMIN" ? "/admin" : "/" }, 200, { "Set-Cookie": await createSessionCookie(user, context.env.SESSION_SECRET) });
  } catch { return json({ error: "Connexion impossible pour le moment." }, 500); }
}

import { createSessionCookie, hashPassword, json, readBody, sameOrigin, validEmail } from "../../_lib/auth.js";

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  try {
    const body = await readBody(context.request); const name = String(body.name || "").trim(); const email = String(body.email || "").trim().toLowerCase(); const password = String(body.password || "");
    if (name.length < 2 || !validEmail(email) || password.length < 6 || password.length > 128) return json({ error: "Vérifiez le nom, l’e-mail et le mot de passe de six caractères minimum." }, 400);
    const existing = await context.env.DB.prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    if (existing) return json({ error: "Un compte existe déjà avec cette adresse." }, 409);
    const user = { id: crypto.randomUUID(), name, email, role: "USER" };
    await context.env.DB.prepare("INSERT INTO users (id, name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, 'USER', ?)").bind(user.id, name, email, await hashPassword(password), new Date().toISOString()).run();
    if (!context.env.SESSION_SECRET) return json({ error: "Configuration de session indisponible." }, 503);
    return json({ ok: true, redirect: "/" }, 201, { "Set-Cookie": await createSessionCookie(user, context.env.SESSION_SECRET) });
  } catch (error) { console.error("registration_failed", error); return json({ error: error?.message === "PAYLOAD_TOO_LARGE" ? "Requête trop volumineuse." : "Création du compte impossible." }, error?.message === "PAYLOAD_TOO_LARGE" ? 413 : 500); }
}

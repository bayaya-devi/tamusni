import { json, readBody, sameOrigin, validEmail } from "../_lib/auth.js";

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  try {
    const body = await readBody(context.request); const email = String(body.email || "").trim().toLowerCase(); const locale = String(body.locale || "fr").slice(0, 8);
    if (!validEmail(email)) return json({ error: "Adresse e-mail invalide." }, 400);
    await context.env.DB.prepare("INSERT OR IGNORE INTO newsletter_subscribers (id, email, locale, created_at) VALUES (?, ?, ?, ?)").bind(crypto.randomUUID(), email, locale, new Date().toISOString()).run();
    return json({ ok: true, message: "Merci — vous recevrez la prochaine édition." }, 201);
  } catch (error) { return json({ error: error?.message === "PAYLOAD_TOO_LARGE" ? "Requête trop volumineuse." : "Inscription impossible pour le moment." }, error?.message === "PAYLOAD_TOO_LARGE" ? 413 : 500); }
}

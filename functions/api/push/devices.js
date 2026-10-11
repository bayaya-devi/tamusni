import { json, readBody, requireSession, sameOrigin } from "../../_lib/auth.js";

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireSession(context);
  if (!session) return json({ error: "Connexion requise." }, 401);
  const body = await readBody(context.request, 10_000);
  const token = String(body.token || "").trim();
  const platform = String(body.platform || "");
  if (token.length < 40 || token.length > 4096 || !["android", "ios"].includes(platform)) return json({ error: "Appareil ou jeton invalide." }, 400);
  const now = new Date().toISOString();
  await context.env.DB.prepare("INSERT INTO push_devices(id,user_id,token,platform,active,created_at,updated_at,last_seen_at) VALUES(?,?,?,?,1,?,?,?) ON CONFLICT(token) DO UPDATE SET user_id=excluded.user_id,platform=excluded.platform,active=1,updated_at=excluded.updated_at,last_seen_at=excluded.last_seen_at")
    .bind(crypto.randomUUID(), session.sub, token, platform, now, now, now).run();
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireSession(context);
  if (!session) return json({ error: "Connexion requise." }, 401);
  const body = await readBody(context.request, 10_000);
  const token = String(body.token || "").trim();
  if (!token) return json({ error: "Jeton manquant." }, 400);
  await context.env.DB.prepare("UPDATE push_devices SET active=0,updated_at=?,last_seen_at=? WHERE user_id=? AND token=?").bind(new Date().toISOString(), new Date().toISOString(), session.sub, token).run();
  return json({ ok: true });
}

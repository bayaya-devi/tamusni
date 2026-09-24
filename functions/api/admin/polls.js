import { cleanText, json, readBody, requireAdmin, sameOrigin } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  if (!await requireAdmin(context)) return json({ error: "Accès réservé à l’administration." }, 403);
  const result = await context.env.DB.prepare("SELECT p.id,p.question,p.options_json,p.active,p.closes_at,p.created_at,COUNT(v.user_id) AS votes FROM polls p LEFT JOIN poll_votes v ON v.poll_id=p.id GROUP BY p.id ORDER BY p.created_at DESC").all();
  return json({ items: result.results || [] });
}

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const admin = await requireAdmin(context); if (!admin) return json({ error: "Accès réservé à l’administration." }, 403);
  const body = await readBody(context.request); const question = cleanText(body.question,240);
  const options = String(body.options || "").split("\n").map((item) => cleanText(item,120)).filter(Boolean).slice(0,8);
  if (question.length < 5 || options.length < 2) return json({ error: "Ajoutez une question et au moins deux réponses." }, 400);
  const id = crypto.randomUUID(); const now = new Date().toISOString();
  await context.env.DB.prepare("INSERT INTO polls(id,question,options_json,active,created_at,created_by,closes_at) VALUES(?,?,?,1,?,?,?)").bind(id,question,JSON.stringify(options),now,admin.sub,body.closesAt||null).run();
  return json({ ok: true, id }, 201);
}

export async function onRequestPatch(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  if (!await requireAdmin(context)) return json({ error: "Accès réservé à l’administration." }, 403);
  const body = await readBody(context.request); const id = cleanText(body.id,160);
  if (!id) return json({ error: "Sondage invalide." }, 400);
  await context.env.DB.prepare("UPDATE polls SET active=? WHERE id=?").bind(body.active ? 1 : 0,id).run();
  return json({ ok: true });
}

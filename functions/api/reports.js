import { cleanText, json, readBody, requireSession, sameOrigin } from "../_lib/auth.js";
const targets = new Set(["content", "comment"]);
export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireSession(context); if (!session) return json({ error: "Connexion requise." }, 401);
  const body = await readBody(context.request); const targetType = cleanText(body.targetType, 20); const targetId = cleanText(body.targetId, 160); const reason = cleanText(body.reason, 80); const details = cleanText(body.details, 1000);
  if (!targets.has(targetType) || !targetId || reason.length < 3) return json({ error: "Signalement invalide." }, 400);
  const now = new Date().toISOString(); const id = crypto.randomUUID();
  await context.env.DB.prepare("INSERT INTO reports(id,reporter_user_id,target_type,target_id,reason,details,status,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(id, session.sub, targetType, targetId, reason, details, "open", now).run();
  try { await context.env.DB.prepare("INSERT INTO admin_notifications(id,type,title,body,target_url,target_type,target_id,created_at) VALUES(?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),"report","Nouveau signalement",`Signalement concernant un ${targetType}.`,"/admin/#notifications","report",id,now).run(); } catch (error) { console.error("admin_notification_failed", error); }
  return json({ ok: true }, 201);
}

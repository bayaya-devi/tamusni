import { cleanText, json, readBody, requireAdmin, sameOrigin } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  if (!await requireAdmin(context)) return json({ error: "Accès réservé à l’administration." }, 403);
  const result = await context.env.DB.prepare("SELECT * FROM admin_notifications ORDER BY CASE WHEN read_at IS NULL THEN 0 ELSE 1 END, created_at DESC LIMIT 150").all();
  return json({ items: result.results || [] });
}

export async function onRequestPatch(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const admin = await requireAdmin(context); if (!admin) return json({ error: "Accès réservé à l’administration." }, 403);
  const body = await readBody(context.request); const id = cleanText(body.id, 160);
  if (!id || !["read", "unread"].includes(body.action)) return json({ error: "Modification invalide." }, 400);
  await context.env.DB.prepare("UPDATE admin_notifications SET read_at=? WHERE id=?").bind(body.action === "read" ? new Date().toISOString() : null, id).run();
  await context.env.DB.prepare("INSERT INTO admin_audit_log(id,admin_user_id,action,target_type,target_id,metadata,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(), admin.sub, `notification.${body.action}`, "admin_notification", id, "{}", new Date().toISOString()).run();
  return json({ ok: true });
}

export async function onRequestDelete(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const admin = await requireAdmin(context); if (!admin) return json({ error: "Accès réservé à l’administration." }, 403);
  const body = await readBody(context.request); const id = cleanText(body.id, 160);
  if (!id) return json({ error: "Notification introuvable." }, 400);
  await context.env.DB.prepare("DELETE FROM admin_notifications WHERE id=?").bind(id).run();
  await context.env.DB.prepare("INSERT INTO admin_audit_log(id,admin_user_id,action,target_type,target_id,metadata,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(), admin.sub, "notification.delete", "admin_notification", id, "{}", new Date().toISOString()).run();
  return json({ ok: true });
}

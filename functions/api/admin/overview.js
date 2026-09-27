import { json, requireAdmin } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  if (!await requireAdmin(context)) return json({ error: "Accès réservé à l’administration." }, 403);
  const db = context.env.DB;
  const [users, published, drafts, scheduled, reports, moderation, views, audit] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS count FROM users WHERE role='USER'").first(),
    db.prepare("SELECT COUNT(*) AS count FROM content_items WHERE status='published'").first(),
    db.prepare("SELECT COUNT(*) AS count FROM content_items WHERE status='draft'").first(),
    db.prepare("SELECT COUNT(*) AS count FROM content_items WHERE status='scheduled'").first(),
    db.prepare("SELECT COUNT(*) AS count FROM reports WHERE status IN ('open','reviewing')").first(),
    db.prepare("SELECT COUNT(*) AS count FROM comments WHERE status IN ('pending','reported')").first(),
    db.prepare("SELECT COUNT(*) AS count FROM content_views").first(),
    db.prepare("SELECT a.action,a.target_type,a.target_id,a.metadata,a.created_at,u.name AS admin_name FROM admin_audit_log a LEFT JOIN users u ON u.id=a.admin_user_id ORDER BY a.created_at DESC LIMIT 12").all()
  ]);
  return json({
    stats: { users: Number(users?.count || 0), published: Number(published?.count || 0), drafts: Number(drafts?.count || 0), scheduled: Number(scheduled?.count || 0), reports: Number(reports?.count || 0), moderation: Number(moderation?.count || 0), views: Number(views?.count || 0) },
    audit: audit.results || []
  });
}

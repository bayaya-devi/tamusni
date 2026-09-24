import { cleanText, json, readBody, requireAdmin, sameOrigin } from "../../_lib/auth.js";
const statuses = new Set(["approved","rejected"]);

export async function onRequestGet(context) {
  if (!await requireAdmin(context)) return json({ error: "Accès réservé à l’administration." }, 403);
  const [posts, topics] = await Promise.all([
    context.env.DB.prepare("SELECT p.id,p.body,p.status,p.created_at,u.name,t.title,t.slug,'post' AS kind FROM forum_posts p JOIN users u ON u.id=p.user_id JOIN forum_topics t ON t.id=p.topic_id WHERE p.status IN ('pending','reported') ORDER BY p.created_at LIMIT 200").all(),
    context.env.DB.prepare("SELECT t.id,t.description AS body,t.status,t.created_at,COALESCE(u.name,'Membre') AS name,t.title,t.slug,'topic' AS kind FROM forum_topics t LEFT JOIN users u ON u.id=t.created_by WHERE t.status='pending' ORDER BY t.created_at LIMIT 100").all()
  ]);
  return json({ items: [...(topics.results || []), ...(posts.results || [])] });
}

export async function onRequestPatch(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const admin = await requireAdmin(context); if (!admin) return json({ error: "Accès réservé à l’administration." }, 403);
  const body = await readBody(context.request); const id = cleanText(body.id,160); const status = statuses.has(body.status) ? body.status : null; const kind = body.kind === "topic" ? "topic" : "post";
  if (!id || !status) return json({ error: "Décision invalide." }, 400);
  const storedStatus = kind === "topic" ? (status === "approved" ? "open" : "archived") : status;
  const table = kind === "topic" ? "forum_topics" : "forum_posts";
  await context.env.DB.prepare(`UPDATE ${table} SET status=?,updated_at=? WHERE id=?`).bind(storedStatus,new Date().toISOString(),id).run();
  await context.env.DB.prepare("INSERT INTO admin_audit_log(id,admin_user_id,action,target_type,target_id,metadata,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),admin.sub,"forum.moderate",kind === "topic" ? "forum_topic" : "forum_post",id,JSON.stringify({status:storedStatus}),new Date().toISOString()).run();
  return json({ ok: true });
}

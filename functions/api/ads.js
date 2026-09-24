import { cleanText, json, readBody, sameOrigin } from "../_lib/auth.js";

export async function onRequestGet(context) {
  const placement = cleanText(new URL(context.request.url).searchParams.get("placement"), 40);
  const allowed = new Set(["sidebar-hero", "mid-page", "footer-top", "article-inline"]);
  if (!allowed.has(placement)) return json({ item: null });
  const now = new Date().toISOString();
  const item = await context.env.DB.prepare("SELECT id,placement,ad_type,headline,body,image_url,target_url,advertiser FROM advertisements WHERE placement=? AND status='active' AND (starts_at IS NULL OR starts_at<=?) AND (ends_at IS NULL OR ends_at>?) ORDER BY updated_at DESC LIMIT 1").bind(placement, now, now).first();
  if (item) await context.env.DB.prepare("UPDATE advertisements SET impressions=impressions+1 WHERE id=?").bind(item.id).run();
  return json({ item: item || null }, 200, { "Cache-Control": "private, max-age=60" });
}

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const body = await readBody(context.request); const id = cleanText(body.id, 160);
  if (!id) return json({ error: "Publicité invalide." }, 400);
  const item = await context.env.DB.prepare("SELECT target_url FROM advertisements WHERE id=? AND status='active'").bind(id).first();
  if (!item) return json({ error: "Publicité inactive." }, 404);
  await context.env.DB.prepare("UPDATE advertisements SET clicks=clicks+1 WHERE id=?").bind(id).run();
  return json({ ok: true, targetUrl: item.target_url });
}

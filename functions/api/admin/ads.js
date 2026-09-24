import { cleanText, json, readBody, requireAdmin, sameOrigin } from "../../_lib/auth.js";
const placements = new Set(["sidebar-hero", "mid-page", "footer-top", "article-inline"]);
const statuses = new Set(["draft", "active", "paused", "ended"]);
const adTypes = new Set(["display", "native", "sponsored", "affiliate", "house"]);
const adsenseFormats = new Set(["auto", "rectangle", "horizontal", "vertical"]);
const httpsUrl = (value) => /^https:\/\//i.test(String(value || "")) ? String(value) : null;

export async function onRequestGet(context) {
  if (!await requireAdmin(context)) return json({ error: "Accès réservé à l’administration." }, 403);
  const result = await context.env.DB.prepare("SELECT * FROM advertisements ORDER BY updated_at DESC LIMIT 100").all();
  return json({ items: result.results || [] });
}

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const admin = await requireAdmin(context); if (!admin) return json({ error: "Accès réservé à l’administration." }, 403);
  const body = await readBody(context.request); const placement = placements.has(body.placement) ? body.placement : null; const isAdsense = body.adType === "adsense"; const adType = isAdsense ? "native" : adTypes.has(body.adType) ? body.adType : null;
  const name = cleanText(body.name, 120); const headline = cleanText(body.headline, 180); const advertiser = cleanText(body.advertiser, 120); const targetUrl = httpsUrl(body.targetUrl);
  const imageUrl = httpsUrl(body.imageUrl);
  const adsenseClient = cleanText(body.adsenseClient, 40); const adsenseSlot = cleanText(body.adsenseSlot, 30); const adsenseFormat = adsenseFormats.has(body.adsenseFormat) ? body.adsenseFormat : "auto";
  if (!placement || !adType || name.length < 2) return json({ error: "Campagne publicitaire incomplète." }, 400);
  if (isAdsense && (!/^ca-pub-\d{16}$/.test(adsenseClient) || !/^\d{5,20}$/.test(adsenseSlot))) return json({ error: "Identifiants Google AdSense invalides." }, 400);
  if (!isAdsense && (headline.length < 3 || advertiser.length < 2 || !targetUrl || (adType === "display" && !imageUrl))) return json({ error: adType === "display" && !imageUrl ? "Une bannière visuelle exige une image HTTPS." : "Campagne publicitaire directe incomplète." }, 400);
  const id = crypto.randomUUID(); const now = new Date().toISOString(); const status = statuses.has(body.status) ? body.status : "draft";
  await context.env.DB.prepare("INSERT INTO advertisements(id,name,placement,ad_type,provider,adsense_client,adsense_slot,adsense_format,headline,body,image_url,target_url,advertiser,status,starts_at,ends_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(id,name,placement,adType,isAdsense?"adsense":"direct",isAdsense?adsenseClient:null,isAdsense?adsenseSlot:null,isAdsense?adsenseFormat:null,isAdsense?"Google AdSense":headline,isAdsense?"":cleanText(body.body,500),isAdsense?null:imageUrl,isAdsense?"https://www.google.com/adsense/start/":targetUrl,isAdsense?"Google AdSense":advertiser,status,body.startsAt||null,body.endsAt||null,now,now).run();
  await context.env.DB.prepare("INSERT INTO admin_audit_log(id,admin_user_id,action,target_type,target_id,metadata,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),admin.sub,"ad.create","advertisement",id,JSON.stringify({placement,adType:isAdsense?"adsense":adType,status}),now).run();
  return json({ ok: true, id }, 201);
}

export async function onRequestPatch(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const admin = await requireAdmin(context); if (!admin) return json({ error: "Accès réservé à l’administration." }, 403);
  const body = await readBody(context.request); const id = cleanText(body.id,160); const status = statuses.has(body.status) ? body.status : null;
  if (!id || !status) return json({ error: "Modification invalide." }, 400);
  await context.env.DB.prepare("UPDATE advertisements SET status=?,updated_at=? WHERE id=?").bind(status,new Date().toISOString(),id).run();
  await context.env.DB.prepare("INSERT INTO admin_audit_log(id,admin_user_id,action,target_type,target_id,metadata,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),admin.sub,"ad.status","advertisement",id,JSON.stringify({status}),new Date().toISOString()).run();
  return json({ ok: true });
}

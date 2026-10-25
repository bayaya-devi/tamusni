import { cleanText, json, readBody, requireBusiness, sameOrigin } from "../../_lib/auth.js";
import { campaignCanBeEdited, validateBusinessCampaign } from "../../_lib/business-core.js";

const selectCampaign = (db, id, owner) => db.prepare("SELECT * FROM business_campaigns WHERE id=? AND business_user_id=?").bind(id, owner).first();

export async function onRequestGet(context) {
  const session = await requireBusiness(context);
  if (!session) return json({ error: "Espace entreprise requis." }, 403);
  const id = cleanText(new URL(context.request.url).searchParams.get("id"), 100);
  if (id) {
    const campaign = await selectCampaign(context.env.DB, id, session.sub);
    return campaign ? json({ campaign }) : json({ error: "Campagne introuvable." }, 404);
  }
  const result = await context.env.DB.prepare("SELECT * FROM business_campaigns WHERE business_user_id=? ORDER BY created_at DESC LIMIT 100").bind(session.sub).all();
  return json({ items: result.results || [] });
}

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireBusiness(context);
  if (!session) return json({ error: "Espace entreprise requis." }, 403);
  const profile = await context.env.DB.prepare("SELECT verification_status,max_active_campaigns FROM business_profiles WHERE user_id=?").bind(session.sub).first();
  if (!profile || profile.verification_status === "suspended") return json({ error: "Compte entreprise indisponible." }, 403);
  const validation = validateBusinessCampaign(await readBody(context.request, 40_000));
  if (!validation.ok) return json({ error: "La campagne est incomplète ou invalide.", fields: validation.errors }, 400);
  const active = await context.env.DB.prepare("SELECT COUNT(*) AS total FROM business_campaigns WHERE business_user_id=? AND status IN ('submitted','approved','awaiting_payment','paid','scheduled','active')").bind(session.sub).first();
  if (Number(active?.total || 0) >= Number(profile.max_active_campaigns || 10)) return json({ error: "Limite de campagnes actives atteinte." }, 409);
  const c = validation.campaign; const id = crypto.randomUUID(); const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare(`INSERT INTO business_campaigns(id,business_user_id,campaign_type,content_type,title,short_description,detailed_description,image_url,destination_url,cta,industry,objective,audience_json,countries_json,languages_json,duration_days,price_cents,currency,status,start_mode,scheduled_start_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(id,session.sub,c.campaignType,c.contentType,c.title,c.shortDescription,c.detailedDescription,c.imageUrl,c.destinationUrl,c.cta,c.industry,c.objective,JSON.stringify(c.audience),JSON.stringify(c.countries),JSON.stringify(c.languages),c.durationDays,c.priceCents,c.currency,"draft",c.startMode,c.scheduledStartAt,now,now),
    context.env.DB.prepare("INSERT INTO business_campaign_events(id,campaign_id,actor_user_id,event_type,detail_json,created_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),id,session.sub,"created","{}",now)
  ]);
  return json({ ok: true, campaign: await selectCampaign(context.env.DB, id, session.sub) }, 201);
}

export async function onRequestPatch(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireBusiness(context);
  if (!session) return json({ error: "Espace entreprise requis." }, 403);
  const body = await readBody(context.request, 40_000); const id = cleanText(body.id, 100);
  const existing = id && await selectCampaign(context.env.DB, id, session.sub);
  if (!existing) return json({ error: "Campagne introuvable." }, 404);
  if (body.action === "submit") {
    const profile = await context.env.DB.prepare("SELECT verification_status FROM business_profiles WHERE user_id=?").bind(session.sub).first();
    if (profile?.verification_status !== "verified") return json({ error: "La validation de l’entreprise est requise avant l’envoi." }, 409);
    if (!campaignCanBeEdited(existing.status)) return json({ error: "Cette campagne ne peut plus être envoyée." }, 409);
    const now = new Date().toISOString();
    await context.env.DB.batch([
      context.env.DB.prepare("UPDATE business_campaigns SET status='submitted',review_reason=NULL,updated_at=? WHERE id=? AND business_user_id=?").bind(now,id,session.sub),
      context.env.DB.prepare("INSERT INTO business_campaign_events(id,campaign_id,actor_user_id,event_type,detail_json,created_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),id,session.sub,"submitted","{}",now),
      context.env.DB.prepare("INSERT INTO admin_notifications(id,type,title,body,target_url,created_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),"business_campaign_submitted","Nouvelle campagne Business",existing.title,"/admin/?view=business",now)
    ]);
    return json({ ok: true, campaign: await selectCampaign(context.env.DB, id, session.sub) });
  }
  if (!campaignCanBeEdited(existing.status)) return json({ error: "Cette campagne ne peut plus être modifiée." }, 409);
  const validation = validateBusinessCampaign(body);
  if (!validation.ok) return json({ error: "La campagne est incomplète ou invalide.", fields: validation.errors }, 400);
  const c = validation.campaign; const now = new Date().toISOString();
  await context.env.DB.batch([
    context.env.DB.prepare(`UPDATE business_campaigns SET campaign_type=?,content_type=?,title=?,short_description=?,detailed_description=?,image_url=?,destination_url=?,cta=?,industry=?,objective=?,audience_json=?,countries_json=?,languages_json=?,duration_days=?,price_cents=?,currency='EUR',status='draft',start_mode=?,scheduled_start_at=?,review_reason=NULL,updated_at=? WHERE id=? AND business_user_id=?`).bind(c.campaignType,c.contentType,c.title,c.shortDescription,c.detailedDescription,c.imageUrl,c.destinationUrl,c.cta,c.industry,c.objective,JSON.stringify(c.audience),JSON.stringify(c.countries),JSON.stringify(c.languages),c.durationDays,c.priceCents,c.startMode,c.scheduledStartAt,now,id,session.sub),
    context.env.DB.prepare("INSERT INTO business_campaign_events(id,campaign_id,actor_user_id,event_type,detail_json,created_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),id,session.sub,"updated","{}",now)
  ]);
  return json({ ok: true, campaign: await selectCampaign(context.env.DB, id, session.sub) });
}

export async function onRequestDelete(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireBusiness(context);
  if (!session) return json({ error: "Espace entreprise requis." }, 403);
  const { id } = await readBody(context.request); const campaign = await selectCampaign(context.env.DB, cleanText(id, 100), session.sub);
  if (!campaign) return json({ error: "Campagne introuvable." }, 404);
  if (!campaignCanBeEdited(campaign.status)) return json({ error: "Seuls les brouillons peuvent être supprimés." }, 409);
  await context.env.DB.prepare("DELETE FROM business_campaigns WHERE id=? AND business_user_id=?").bind(campaign.id, session.sub).run();
  return json({ ok: true });
}

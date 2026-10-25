import { json, readBody, requireSession, sameOrigin } from "../../_lib/auth.js";
import { validateBusinessProfile } from "../../_lib/business-core.js";

const selectProfile = (db, userId) => db.prepare("SELECT bp.*,u.name AS account_name,u.email AS account_email FROM business_profiles bp JOIN users u ON u.id=bp.user_id WHERE bp.user_id=?").bind(userId).first();

export async function onRequestGet(context) {
  const session = await requireSession(context);
  if (!session) return json({ error: "Authentification requise." }, 401);
  return json({ profile: await selectProfile(context.env.DB, session.sub) || null });
}

async function save(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session = await requireSession(context);
  if (!session || session.role === "ADMIN" || session.role === "CONTRIBUTOR") return json({ error: "Compte utilisateur requis." }, 403);
  const validation = validateBusinessProfile(await readBody(context.request, 30_000));
  if (!validation.ok) return json({ error: "Le profil entreprise est incomplet ou invalide.", fields: validation.errors }, 400);
  const p = validation.profile;
  const existing = await selectProfile(context.env.DB, session.sub);
  const now = new Date().toISOString();
  if (existing?.verification_status === "suspended") return json({ error: "Ce compte entreprise est suspendu." }, 403);
  const unchangedVerified = existing?.verification_status === "verified" && existing.legal_name===p.legalName && existing.trading_name===p.tradingName && existing.description===p.description && existing.industry===p.industry && existing.country===p.country && existing.city===p.city && existing.website_url===p.websiteUrl && existing.professional_email===p.professionalEmail && (existing.phone||null)===(p.phone||null) && (existing.tax_id||null)===(p.taxId||null) && existing.contact_name===p.contactName && existing.contact_role===p.contactRole && (existing.logo_url||null)===(p.logoUrl||null);
  const nextStatus = unchangedVerified ? "verified" : "pending";
  await context.env.DB.prepare(`INSERT INTO business_profiles(user_id,legal_name,trading_name,description,industry,country,city,website_url,professional_email,phone,tax_id,contact_name,contact_role,logo_url,verification_status,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(user_id) DO UPDATE SET legal_name=excluded.legal_name,trading_name=excluded.trading_name,description=excluded.description,industry=excluded.industry,country=excluded.country,city=excluded.city,website_url=excluded.website_url,professional_email=excluded.professional_email,phone=excluded.phone,tax_id=excluded.tax_id,contact_name=excluded.contact_name,contact_role=excluded.contact_role,logo_url=excluded.logo_url,verification_status=?,review_reason=NULL,updated_at=excluded.updated_at`)
    .bind(session.sub,p.legalName,p.tradingName,p.description,p.industry,p.country,p.city,p.websiteUrl,p.professionalEmail,p.phone,p.taxId,p.contactName,p.contactRole,p.logoUrl,nextStatus,now,now,nextStatus).run();
  const profile = await selectProfile(context.env.DB, session.sub);
  return json({ ok: true, profile }, existing ? 200 : 201);
}

export const onRequestPost = save;
export const onRequestPatch = save;

import { json, requireBusiness } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const session = await requireBusiness(context);
  if (!session) return json({ error: "Espace entreprise requis." }, 403);
  const db = context.env.DB;
  const [profile,campaigns,notifications,payments,invoices,metrics] = await Promise.all([
    db.prepare("SELECT * FROM business_profiles WHERE user_id=?").bind(session.sub).first(),
    db.prepare("SELECT * FROM business_campaigns WHERE business_user_id=? ORDER BY created_at DESC LIMIT 100").bind(session.sub).all(),
    db.prepare("SELECT * FROM business_notifications WHERE business_user_id=? ORDER BY created_at DESC LIMIT 100").bind(session.sub).all(),
    db.prepare("SELECT p.* FROM business_payments p JOIN business_campaigns c ON c.id=p.campaign_id WHERE c.business_user_id=? ORDER BY p.created_at DESC LIMIT 100").bind(session.sub).all(),
    db.prepare("SELECT * FROM business_invoices WHERE business_user_id=? ORDER BY issued_at DESC LIMIT 100").bind(session.sub).all(),
    db.prepare("SELECT m.* FROM business_campaign_metrics m JOIN business_campaigns c ON c.id=m.campaign_id WHERE c.business_user_id=? ORDER BY m.metric_date DESC LIMIT 366").bind(session.sub).all()
  ]);
  return json({ profile, campaigns:campaigns.results||[], notifications:notifications.results||[], payments:payments.results||[], invoices:invoices.results||[], metrics:metrics.results||[] });
}

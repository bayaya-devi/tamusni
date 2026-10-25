import { cleanText, json, readBody, requireAdmin, sameOrigin } from "../../_lib/auth.js";
import { emailLayout, sendEmail } from "../../_lib/email.js";

const profileTransitions = {
  approve: "verified", request_changes: "changes_requested", refuse: "refused",
  suspend: "suspended", reactivate: "pending"
};
const campaignTransitions = {
  approve: "awaiting_payment", request_changes: "changes_requested", refuse: "refused",
  suspend: "suspended", resume: "active", complete: "completed"
};
const needsReason = new Set(["request_changes", "refuse", "suspend"]);

const audit = (db, admin, action, targetType, targetId, metadata, now) => db.prepare("INSERT INTO admin_audit_log(id,admin_user_id,action,target_type,target_id,metadata,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),admin.sub,action,targetType,targetId,JSON.stringify(metadata),now);

export async function onRequestGet(context) {
  if (!await requireAdmin(context)) return json({ error: "Accès réservé à l’administration." }, 403);
  const url = new URL(context.request.url); const type = cleanText(url.searchParams.get("type"), 20); const id = cleanText(url.searchParams.get("id"), 100);
  if (type === "profile" && id) {
    const profile = await context.env.DB.prepare("SELECT bp.*,u.name AS account_name,u.email AS account_email,u.is_banned FROM business_profiles bp JOIN users u ON u.id=bp.user_id WHERE bp.user_id=?").bind(id).first();
    if (!profile) return json({ error: "Entreprise introuvable." }, 404);
    const campaigns = await context.env.DB.prepare("SELECT * FROM business_campaigns WHERE business_user_id=? ORDER BY created_at DESC").bind(id).all();
    return json({ profile, campaigns:campaigns.results||[] });
  }
  if (type === "campaign" && id) {
    const campaign = await context.env.DB.prepare("SELECT c.*,bp.trading_name,bp.verification_status,u.email AS account_email FROM business_campaigns c JOIN business_profiles bp ON bp.user_id=c.business_user_id JOIN users u ON u.id=c.business_user_id WHERE c.id=?").bind(id).first();
    if (!campaign) return json({ error: "Campagne introuvable." }, 404);
    const events = await context.env.DB.prepare("SELECT * FROM business_campaign_events WHERE campaign_id=? ORDER BY created_at DESC").bind(id).all();
    return json({ campaign, events:events.results||[] });
  }
  const [profiles,campaigns,counts] = await Promise.all([
    context.env.DB.prepare("SELECT bp.*,u.name AS account_name,u.email AS account_email FROM business_profiles bp JOIN users u ON u.id=bp.user_id ORDER BY bp.updated_at DESC LIMIT 200").all(),
    context.env.DB.prepare("SELECT c.*,bp.trading_name FROM business_campaigns c JOIN business_profiles bp ON bp.user_id=c.business_user_id ORDER BY c.updated_at DESC LIMIT 300").all(),
    context.env.DB.prepare("SELECT (SELECT COUNT(*) FROM business_profiles) AS profiles,(SELECT COUNT(*) FROM business_profiles WHERE verification_status='pending') AS profiles_pending,(SELECT COUNT(*) FROM business_campaigns) AS campaigns,(SELECT COUNT(*) FROM business_campaigns WHERE status='submitted') AS campaigns_pending").first()
  ]);
  return json({ profiles:profiles.results||[], campaigns:campaigns.results||[], counts });
}

export async function onRequestPatch(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const admin = await requireAdmin(context); if (!admin) return json({ error: "Accès réservé à l’administration." }, 403);
  const body = await readBody(context.request, 20_000); const targetType = body.targetType === "profile" ? "profile" : body.targetType === "campaign" ? "campaign" : "";
  const id = cleanText(body.id, 100); const action = cleanText(body.action, 40); const reason = cleanText(body.reason, 1_000);
  if (!targetType || !id || !action || (needsReason.has(action) && reason.length < 5)) return json({ error: "Action ou motif invalide." }, 400);
  const now = new Date().toISOString(); let email; let title; let nextStatus;
  if (targetType === "profile") {
    nextStatus = profileTransitions[action]; if (!nextStatus) return json({ error: "Transition inconnue." }, 400);
    const target = await context.env.DB.prepare("SELECT bp.*,u.email FROM business_profiles bp JOIN users u ON u.id=bp.user_id WHERE bp.user_id=?").bind(id).first();
    if (!target) return json({ error: "Entreprise introuvable." }, 404);
    await context.env.DB.batch([
      context.env.DB.prepare("UPDATE business_profiles SET verification_status=?,review_reason=?,verified_at=?,verified_by=?,updated_at=? WHERE user_id=?").bind(nextStatus,reason||null,nextStatus==="verified"?now:null,nextStatus==="verified"?admin.sub:null,now,id),
      context.env.DB.prepare("INSERT INTO business_notifications(id,business_user_id,type,title,body,target_url,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),id,`profile_${nextStatus}`,"Statut de votre entreprise",reason||`Votre entreprise est maintenant ${nextStatus}.`,"/business/espace/",now),
      audit(context.env.DB,admin,`business.profile.${action}`,"business_profile",id,{from:target.verification_status,to:nextStatus,reason},now)
    ]);
    email=target.email; title="Mise à jour de votre compte TAMUSNI Business";
  } else {
    nextStatus = campaignTransitions[action]; if (!nextStatus) return json({ error: "Transition inconnue." }, 400);
    const target = await context.env.DB.prepare("SELECT c.*,bp.verification_status,u.email FROM business_campaigns c JOIN business_profiles bp ON bp.user_id=c.business_user_id JOIN users u ON u.id=c.business_user_id WHERE c.id=?").bind(id).first();
    if (!target) return json({ error: "Campagne introuvable." }, 404);
    if (action === "approve" && (target.status !== "submitted" || target.verification_status !== "verified")) return json({ error: "La campagne ou l’entreprise n’est pas éligible à la validation." }, 409);
    if (action === "resume" && target.status !== "suspended") return json({ error: "Seule une campagne suspendue peut reprendre." }, 409);
    await context.env.DB.batch([
      context.env.DB.prepare("UPDATE business_campaigns SET status=?,review_reason=?,approved_at=?,approved_by=?,updated_at=? WHERE id=?").bind(nextStatus,reason||null,action==="approve"?now:target.approved_at,action==="approve"?admin.sub:target.approved_by,now,id),
      context.env.DB.prepare("INSERT INTO business_campaign_events(id,campaign_id,actor_user_id,event_type,detail_json,created_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),id,admin.sub,`admin_${action}`,JSON.stringify({reason,from:target.status,to:nextStatus}),now),
      context.env.DB.prepare("INSERT INTO business_notifications(id,business_user_id,type,title,body,target_url,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),target.business_user_id,`campaign_${nextStatus}`,target.title,reason||`La campagne est maintenant ${nextStatus}.`,"/business/espace/",now),
      audit(context.env.DB,admin,`business.campaign.${action}`,"business_campaign",id,{from:target.status,to:nextStatus,reason},now)
    ]);
    email=target.email; title=`Campagne TAMUSNI Business — ${target.title}`;
  }
  let emailStatus = "sent";
  try {
    await sendEmail(context.env,{to:email,subject:title,html:emailLayout(title,`<p>${reason || `Nouveau statut : ${nextStatus}`}</p>`),text:reason || `Nouveau statut : ${nextStatus}`});
  } catch (error) { emailStatus = "failed"; console.error("business_status_email_failed", error); }
  return json({ ok:true, status:nextStatus, email:emailStatus });
}

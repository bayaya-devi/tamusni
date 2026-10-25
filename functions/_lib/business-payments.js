export function paymentIdempotencyKey(campaignId, provider) {
  return `business:${campaignId}:${provider}`;
}

export async function markBusinessPaymentPaid(db, payment, providerReference, now = new Date().toISOString()) {
  if (!payment || payment.status === "paid") return { changed:false, payment };
  const campaign = await db.prepare("SELECT * FROM business_campaigns WHERE id=?").bind(payment.campaign_id).first();
  if (!campaign || !["awaiting_payment","paid","scheduled"].includes(campaign.status)) throw new Error("CAMPAIGN_NOT_PAYABLE");
  if (Number(payment.amount_cents) !== Number(campaign.price_cents) || payment.currency !== campaign.currency) throw new Error("PAYMENT_AMOUNT_MISMATCH");
  const startAt = campaign.start_mode === "scheduled" ? campaign.scheduled_start_at : now;
  const invoiceId = crypto.randomUUID();
  const invoiceNumber = `TM-${now.slice(0,10).replaceAll("-","")}-${payment.id.slice(0,8).toUpperCase()}`;
  await db.batch([
    db.prepare("UPDATE business_payments SET provider_reference=COALESCE(provider_reference,?),status='paid',paid_at=?,updated_at=? WHERE id=? AND status<>'paid'").bind(providerReference||null,now,now,payment.id),
    db.prepare("UPDATE business_campaigns SET status='scheduled',paid_at=?,scheduled_start_at=?,updated_at=? WHERE id=? AND status='awaiting_payment'").bind(now,startAt,now,campaign.id),
    db.prepare("INSERT OR IGNORE INTO business_invoices(id,invoice_number,business_user_id,campaign_id,payment_id,amount_cents,currency,status,issued_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(invoiceId,invoiceNumber,campaign.business_user_id,campaign.id,payment.id,payment.amount_cents,payment.currency,"issued",now),
    db.prepare("INSERT INTO business_campaign_events(id,campaign_id,actor_user_id,event_type,detail_json,created_at) VALUES(?,?,?,?,?,?)").bind(crypto.randomUUID(),campaign.id,campaign.business_user_id,"payment_confirmed",JSON.stringify({provider:payment.provider,reference:providerReference||null}),now),
    db.prepare("INSERT INTO business_notifications(id,business_user_id,type,title,body,target_url,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),campaign.business_user_id,"payment_confirmed","Paiement confirmé",campaign.title,"/business/espace/",now)
  ]);
  return { changed:true, campaignId:campaign.id };
}

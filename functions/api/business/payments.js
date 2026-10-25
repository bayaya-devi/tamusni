import { cleanText, json, readBody, requireBusiness, sameOrigin } from "../../_lib/auth.js";
import { paymentIdempotencyKey } from "../../_lib/business-payments.js";

const publicOrigin = (context) => (context.env.PUBLIC_SITE_URL || new URL(context.request.url).origin).replace(/\/$/, "");

async function paypalToken(env) {
  if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) throw new Error("PAYPAL_NOT_CONFIGURED");
  const base = env.PAYPAL_ENV === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
  const auth = btoa(`${env.PAYPAL_CLIENT_ID}:${env.PAYPAL_CLIENT_SECRET}`);
  const response = await fetch(`${base}/v1/oauth2/token`, { method:"POST", headers:{Authorization:`Basic ${auth}`,"Content-Type":"application/x-www-form-urlencoded"}, body:"grant_type=client_credentials" });
  if (!response.ok) throw new Error("PAYPAL_AUTH_FAILED");
  return { base, token:(await response.json()).access_token };
}

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error:"Origine refusée." },403);
  const session = await requireBusiness(context); if (!session) return json({ error:"Espace entreprise requis." },403);
  try {
    const body = await readBody(context.request); const campaignId = cleanText(body.campaignId,100); const provider = body.provider === "paypal" ? "paypal" : body.provider === "stripe" ? "stripe" : "";
    const locale = ["fr","ar","en","es","pt"].includes(body.locale) ? body.locale : "fr";
    if (!campaignId || !provider) return json({ error:"Paiement invalide." },400);
    const campaign = await context.env.DB.prepare("SELECT c.*,bp.verification_status FROM business_campaigns c JOIN business_profiles bp ON bp.user_id=c.business_user_id WHERE c.id=? AND c.business_user_id=?").bind(campaignId,session.sub).first();
    if (!campaign) return json({ error:"Campagne introuvable." },404);
    if (campaign.verification_status !== "verified" || campaign.status !== "awaiting_payment") return json({ error:"Cette campagne n’est pas payable." },409);
    const key = paymentIdempotencyKey(campaign.id,provider); const now = new Date().toISOString();
    let payment = await context.env.DB.prepare("SELECT * FROM business_payments WHERE idempotency_key=?").bind(key).first();
    if (payment?.status === "paid") return json({ error:"Cette campagne est déjà payée." },409);
    if (!payment) {
      payment={id:crypto.randomUUID(),campaign_id:campaign.id,provider,amount_cents:campaign.price_cents,currency:"EUR",status:"created"};
      await context.env.DB.prepare("INSERT INTO business_payments(id,campaign_id,provider,idempotency_key,amount_cents,currency,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(payment.id,campaign.id,provider,key,campaign.price_cents,"EUR","created",now,now).run();
    }
    const origin=publicOrigin(context); const returnUrl=`${origin}/${locale}/business/espace/`;
    if (provider === "stripe") {
      if (!context.env.STRIPE_SECRET_KEY) return json({ error:"Paiement Stripe indisponible." },503);
      const form=new URLSearchParams();
      form.set("mode","payment"); form.set("success_url",`${returnUrl}?payment=stripe-success&session_id={CHECKOUT_SESSION_ID}`); form.set("cancel_url",`${returnUrl}?payment=cancelled`);
      form.set("client_reference_id",payment.id); form.set("metadata[payment_id]",payment.id); form.set("metadata[campaign_id]",campaign.id);
      form.set("line_items[0][price_data][currency]","eur"); form.set("line_items[0][price_data][unit_amount]",String(campaign.price_cents));
      form.set("line_items[0][price_data][product_data][name]",`TAMUSNI Business — ${campaign.title}`); form.set("line_items[0][quantity]","1");
      const response=await fetch("https://api.stripe.com/v1/checkout/sessions",{method:"POST",headers:{Authorization:`Bearer ${context.env.STRIPE_SECRET_KEY}`,"Content-Type":"application/x-www-form-urlencoded","Idempotency-Key":key},body:form});
      const data=await response.json(); if(!response.ok||!data.url)throw new Error(`STRIPE_CREATE_FAILED:${data.error?.code||response.status}`);
      await context.env.DB.prepare("UPDATE business_payments SET provider_reference=?,status='pending',updated_at=? WHERE id=?").bind(data.id,now,payment.id).run();
      return json({ok:true,provider,checkoutUrl:data.url});
    }
    const paypal=await paypalToken(context.env); const response=await fetch(`${paypal.base}/v2/checkout/orders`,{method:"POST",headers:{Authorization:`Bearer ${paypal.token}`,"Content-Type":"application/json","PayPal-Request-Id":key},body:JSON.stringify({intent:"CAPTURE",purchase_units:[{reference_id:payment.id,custom_id:payment.id,description:`TAMUSNI Business — ${campaign.title}`.slice(0,127),amount:{currency_code:"EUR",value:(campaign.price_cents/100).toFixed(2)}}],payment_source:{paypal:{experience_context:{return_url:`${returnUrl}?payment=paypal-return`,cancel_url:`${returnUrl}?payment=cancelled`,user_action:"PAY_NOW"}}}})});
    const data=await response.json(); const approve=data.links?.find((link)=>link.rel==="payer-action"||link.rel==="approve")?.href;
    if(!response.ok||!data.id||!approve)throw new Error(`PAYPAL_CREATE_FAILED:${response.status}`);
    await context.env.DB.prepare("UPDATE business_payments SET provider_reference=?,status='pending',updated_at=? WHERE id=?").bind(data.id,now,payment.id).run();
    return json({ok:true,provider,checkoutUrl:approve});
  } catch(error) { console.error("business_payment_create_failed",error); return json({error:"Impossible de préparer le paiement."},502); }
}

export { paypalToken };

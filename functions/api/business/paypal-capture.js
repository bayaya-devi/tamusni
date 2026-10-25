import { cleanText, json, readBody, requireBusiness, sameOrigin } from "../../_lib/auth.js";
import { markBusinessPaymentPaid } from "../../_lib/business-payments.js";
import { paypalToken } from "./payments.js";

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({error:"Origine refusée."},403);
  const session=await requireBusiness(context); if(!session)return json({error:"Espace entreprise requis."},403);
  try {
    const {orderId}=await readBody(context.request); const reference=cleanText(orderId,160);
    const payment=await context.env.DB.prepare("SELECT p.* FROM business_payments p JOIN business_campaigns c ON c.id=p.campaign_id WHERE p.provider='paypal' AND p.provider_reference=? AND c.business_user_id=?").bind(reference,session.sub).first();
    if(!payment)return json({error:"Paiement introuvable."},404); if(payment.status==="paid")return json({ok:true,alreadyProcessed:true});
    const paypal=await paypalToken(context.env); const response=await fetch(`${paypal.base}/v2/checkout/orders/${encodeURIComponent(reference)}/capture`,{method:"POST",headers:{Authorization:`Bearer ${paypal.token}`,"Content-Type":"application/json","PayPal-Request-Id":payment.idempotency_key}});
    const data=await response.json(); if(!response.ok||data.status!=="COMPLETED")return json({error:"Le paiement PayPal n’est pas confirmé."},409);
    const capture=data.purchase_units?.[0]?.payments?.captures?.[0]; const amount=capture?.amount;
    if(amount?.currency_code!==payment.currency||Math.round(Number(amount?.value||0)*100)!==Number(payment.amount_cents))throw new Error("PAYPAL_AMOUNT_MISMATCH");
    await markBusinessPaymentPaid(context.env.DB,payment,capture?.id||reference);
    return json({ok:true});
  } catch(error){console.error("paypal_capture_failed",error);return json({error:"Confirmation PayPal impossible."},502);}
}

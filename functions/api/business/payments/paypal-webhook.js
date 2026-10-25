import { json } from "../../../_lib/auth.js";
import { markBusinessPaymentPaid } from "../../../_lib/business-payments.js";
import { paypalToken } from "../payments.js";

export async function onRequestPost(context){
  if(!context.env.PAYPAL_WEBHOOK_ID)return json({error:"Webhook indisponible."},503);
  try{
    const event=await context.request.json(); const paypal=await paypalToken(context.env);
    const verification=await fetch(`${paypal.base}/v1/notifications/verify-webhook-signature`,{method:"POST",headers:{Authorization:`Bearer ${paypal.token}`,"Content-Type":"application/json"},body:JSON.stringify({auth_algo:context.request.headers.get("paypal-auth-algo"),cert_url:context.request.headers.get("paypal-cert-url"),transmission_id:context.request.headers.get("paypal-transmission-id"),transmission_sig:context.request.headers.get("paypal-transmission-sig"),transmission_time:context.request.headers.get("paypal-transmission-time"),webhook_id:context.env.PAYPAL_WEBHOOK_ID,webhook_event:event})});
    const verified=await verification.json(); if(!verification.ok||verified.verification_status!=="SUCCESS")return json({error:"Signature invalide."},400);
    if(event.event_type!=="PAYMENT.CAPTURE.COMPLETED")return json({received:true});
    const capture=event.resource; const orderId=capture?.supplementary_data?.related_ids?.order_id;
    const payment=await context.env.DB.prepare("SELECT * FROM business_payments WHERE provider='paypal' AND provider_reference=?").bind(orderId).first();
    if(!payment)return json({error:"Paiement inconnu."},404);
    if(capture.amount?.currency_code!==payment.currency||Math.round(Number(capture.amount?.value||0)*100)!==Number(payment.amount_cents))return json({error:"Montant incohérent."},409);
    await markBusinessPaymentPaid(context.env.DB,payment,capture.id);
    return json({received:true});
  }catch(error){console.error("paypal_webhook_failed",error);return json({error:"Traitement impossible."},500);}
}

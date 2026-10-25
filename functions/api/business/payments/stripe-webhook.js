import { json } from "../../../_lib/auth.js";
import { markBusinessPaymentPaid } from "../../../_lib/business-payments.js";

const encoder=new TextEncoder();
const hex=(bytes)=>[...new Uint8Array(bytes)].map((value)=>value.toString(16).padStart(2,"0")).join("");
const constantTimeEqual=(a,b)=>{if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i+=1)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;};

async function validSignature(payload,header,secret){
  const values=Object.fromEntries(String(header||"").split(",").map((part)=>part.split("=",2)));
  const timestamp=Number(values.t); if(!timestamp||Math.abs(Date.now()/1000-timestamp)>300||!values.v1)return false;
  const key=await crypto.subtle.importKey("raw",encoder.encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const signature=hex(await crypto.subtle.sign("HMAC",key,encoder.encode(`${values.t}.${payload}`)));
  return constantTimeEqual(signature,values.v1);
}

export async function onRequestPost(context){
  if(!context.env.STRIPE_WEBHOOK_SECRET)return json({error:"Webhook indisponible."},503);
  const raw=await context.request.text(); if(!await validSignature(raw,context.request.headers.get("stripe-signature"),context.env.STRIPE_WEBHOOK_SECRET))return json({error:"Signature invalide."},400);
  try{
    const event=JSON.parse(raw); if(event.type!=="checkout.session.completed")return json({received:true});
    const session=event.data?.object; const paymentId=session?.metadata?.payment_id||session?.client_reference_id;
    const payment=await context.env.DB.prepare("SELECT * FROM business_payments WHERE id=? AND provider='stripe'").bind(paymentId).first();
    if(!payment)return json({error:"Paiement inconnu."},404);
    if(session.payment_status!=="paid"||String(session.currency||"").toUpperCase()!==payment.currency||Number(session.amount_total)!==Number(payment.amount_cents))return json({error:"Montant ou statut incohérent."},409);
    await markBusinessPaymentPaid(context.env.DB,payment,session.id);
    return json({received:true});
  }catch(error){console.error("stripe_webhook_failed",error);return json({error:"Traitement impossible."},500);}
}

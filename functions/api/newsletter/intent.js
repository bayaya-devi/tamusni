import { json } from "../../_lib/auth.js";
import { readNewsletterIntent } from "../../_lib/newsletter-service.js";
export async function onRequestGet(context){const intent=await readNewsletterIntent(context);return json({intent:intent?{email:intent.email,locale:intent.locale}:null})}

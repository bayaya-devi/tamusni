import { json, requireSession } from "../_lib/auth.js";
import { recommendationSet } from "../_lib/nervous-service.js";
export async function onRequestGet(context){const session=await requireSession(context);if(!session)return json({error:"Connexion requise."},401);return json(await recommendationSet(context.env,session,20));}

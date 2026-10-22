import { json, readBody, requireSession, sameOrigin } from "../_lib/auth.js";
import { deleteBrevoContact } from "../_lib/brevo.js";
import { subscribeUser, unsubscribeUser } from "../_lib/newsletter-service.js";
import { normalizeNewsletterLocale } from "../_lib/newsletter-core.js";

const messages={fr:{active:"Votre inscription à la revue hebdomadaire est active.",existing:"Cette adresse est déjà inscrite.",continue:"Connectez-vous ou créez votre compte pour confirmer l’inscription.",invalid:"Adresse e-mail invalide."},en:{active:"Your weekly review subscription is active.",existing:"This address is already subscribed.",continue:"Sign in or create your account to confirm the subscription.",invalid:"Invalid email address."},ar:{active:"تم تفعيل اشتراكك في النشرة الأسبوعية.",existing:"هذا العنوان مشترك بالفعل.",continue:"سجّل الدخول أو أنشئ حسابًا لتأكيد الاشتراك.",invalid:"عنوان البريد الإلكتروني غير صالح."},es:{active:"Tu suscripción a la revista semanal está activa.",existing:"Esta dirección ya está suscrita.",continue:"Accede o crea tu cuenta para confirmar la suscripción.",invalid:"Correo electrónico no válido."},pt:{active:"A sua subscrição da revista semanal está ativa.",existing:"Este endereço já está inscrito.",continue:"Entre ou crie a sua conta para confirmar a subscrição.",invalid:"Endereço de e-mail inválido."}};

export async function onRequestGet(context) {
  const session=await requireSession(context);if(!session)return json({error:"Connexion requise."},401);
  const subscriber=await context.env.DB.prepare("SELECT status,locale,subscribed_at,unsubscribed_at FROM newsletter_subscribers WHERE user_id=? OR lower(email)=lower(?) ORDER BY updated_at DESC LIMIT 1").bind(session.sub,session.email).first();
  return json({subscribed:subscriber?.status==="active",subscriber:subscriber||null});
}

export async function onRequestPatch(context) {
  if(!sameOrigin(context.request))return json({error:"Origine refusée."},403);
  const session=await requireSession(context);if(!session)return json({error:"Connexion requise."},401);
  const body=await readBody(context.request);if(body.action!=="unsubscribe")return json({error:"Action invalide."},400);
  const subscriber=await context.env.DB.prepare("SELECT id,email FROM newsletter_subscribers WHERE user_id=? OR lower(email)=lower(?) LIMIT 1").bind(session.sub,session.email).first();
  if(!subscriber)return json({ok:true,subscribed:false});
  const now=new Date().toISOString();
  await context.env.DB.prepare("UPDATE newsletter_subscribers SET status='unsubscribed',unsubscribed_at=?,updated_at=?,brevo_sync_status='unsubscribed' WHERE id=?").bind(now,now,subscriber.id).run();
  try { await deleteBrevoContact(context.env,subscriber.email); }
  catch(error) { await context.env.DB.prepare("UPDATE newsletter_subscribers SET brevo_sync_status='error',updated_at=? WHERE id=?").bind(new Date().toISOString(),subscriber.id).run();console.error("mobile_newsletter_unsubscribe_brevo_failed",error.message);return json({error:"Désinscription enregistrée, mais la synchronisation e-mail est en attente."},202); }
  return json({ok:true,subscribed:false});
}

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." }, 403);
  const session=await requireSession(context);if(!session)return json({error:"Connexion requise."},401);
  try {const body=await readBody(context.request);const locale=normalizeNewsletterLocale(body.locale);const enabled=body.enabled!==false;
    if(!enabled){const result=await unsubscribeUser(context,session);return json({ok:true,subscribed:false,syncPending:result.syncPending===true});}
    const existing=await context.env.DB.prepare("SELECT status FROM newsletter_subscribers WHERE user_id=? OR lower(email)=lower(?)").bind(session.sub,session.email).first();if(existing?.status==='active')return json({ok:true,alreadySubscribed:true,message:messages[locale].existing});const subscriber=await subscribeUser(context,session,locale,"account_preference");return json({ok:true,subscriber:{status:subscriber.status,locale:subscriber.locale},message:messages[locale].active},201);
  } catch(error){console.error("newsletter_subscription_failed",error);return json({error:"Modification impossible pour le moment."},500)}
}

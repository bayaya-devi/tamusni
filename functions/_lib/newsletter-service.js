import { hashToken } from "./auth.js";
import { createBrevoCampaign, deleteBrevoContact, ensureBrevoLists, getBrevoCampaign, sendBrevoCampaign, syncBrevoContact } from "./brevo.js";
import { NEWSLETTER_LOCALES, newsletterCopy, newsletterDue, normalizeNewsletterLocale, selectNewsletterItems, sundayCycle } from "./newsletter-core.js";
import { digest, renderNewsletter } from "./newsletter-template.js";

const nowIso=()=>new Date().toISOString();
const cookieValue=(request,name)=>(request.headers.get("cookie")||"").split(/;\s*/).find(part=>part.startsWith(`${name}=`))?.slice(name.length+1)||"";
const token=()=>{const bytes=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")};

export async function createNewsletterIntent(context,{email,locale}){
  const raw=token(),now=nowIso(),ip=context.request.headers.get("CF-Connecting-IP")||"unknown",ipHash=await hashToken(`newsletter|${ip}`);
  const recent=await context.env.DB.prepare("SELECT COUNT(*) AS count FROM newsletter_intents WHERE ip_hash=? AND created_at>?").bind(ipHash,new Date(Date.now()-3600000).toISOString()).first();
  if(Number(recent?.count||0)>=8)throw new Error("NEWSLETTER_RATE_LIMIT");
  await context.env.DB.prepare("DELETE FROM newsletter_intents WHERE expires_at<? OR consumed_at IS NOT NULL").bind(now).run();
  await context.env.DB.prepare("INSERT INTO newsletter_intents(token_hash,email,locale,ip_hash,expires_at,created_at) VALUES(?,?,?,?,?,?)").bind(await hashToken(raw),email,normalizeNewsletterLocale(locale),ipHash,new Date(Date.now()+30*60000).toISOString(),now).run();
  return {cookie:`tamusni_newsletter_intent=${raw}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=1800`,redirect:`/${normalizeNewsletterLocale(locale)}/connexion/?newsletter=1`};
}

export async function readNewsletterIntent(context){
  const raw=cookieValue(context.request,"tamusni_newsletter_intent");if(!raw)return null;
  return context.env.DB.prepare("SELECT email,locale FROM newsletter_intents WHERE token_hash=? AND consumed_at IS NULL AND expires_at>?").bind(await hashToken(raw),nowIso()).first();
}

export async function subscribeUser(context,user,requestedLocale,source="account"){
  const profile=await context.env.DB.prepare("SELECT email,preferred_language FROM users WHERE id=?").bind(user.id||user.sub).first();
  if(!profile)throw new Error("USER_NOT_FOUND"); const locale=normalizeNewsletterLocale(profile.preferred_language||requestedLocale);const now=nowIso();const id=crypto.randomUUID();
  await context.env.DB.prepare("INSERT INTO newsletter_subscribers(id,user_id,email,locale,status,subscribed_at,email_verified_at,created_at,updated_at,brevo_sync_status,source) VALUES(?,?,?,?,?,?,?,?,?,'pending',?) ON CONFLICT(email) DO UPDATE SET user_id=excluded.user_id,locale=excluded.locale,status='active',subscribed_at=COALESCE(newsletter_subscribers.subscribed_at,excluded.subscribed_at),unsubscribed_at=NULL,email_verified_at=COALESCE(newsletter_subscribers.email_verified_at,excluded.email_verified_at),updated_at=excluded.updated_at,brevo_sync_status='pending',source=excluded.source").bind(id,user.id||user.sub,profile.email.toLowerCase(),locale,"active",now,now,now,now,source).run();
  const subscriber=await context.env.DB.prepare("SELECT * FROM newsletter_subscribers WHERE email=?").bind(profile.email.toLowerCase()).first();
  try{const contactId=await syncBrevoContact(context.env,context.env.DB,subscriber);await context.env.DB.prepare("UPDATE newsletter_subscribers SET brevo_contact_id=COALESCE(?,brevo_contact_id),brevo_sync_status='synced',updated_at=? WHERE id=?").bind(contactId,nowIso(),subscriber.id).run()}catch(error){console.error("newsletter_brevo_sync_failed",error.message);await context.env.DB.prepare("UPDATE newsletter_subscribers SET brevo_sync_status='error',updated_at=? WHERE id=?").bind(nowIso(),subscriber.id).run()}
  return {...subscriber,status:"active",locale};
}

export async function finalizeNewsletterIntent(context,user){
  const intent=await readNewsletterIntent(context);if(!intent)return null;
  if(String(intent.email).toLowerCase()!==String(user.email).toLowerCase())return {mismatch:true};
  const subscriber=await subscribeUser(context,user,intent.locale,"auth_intent");const raw=cookieValue(context.request,"tamusni_newsletter_intent");
  await context.env.DB.prepare("UPDATE newsletter_intents SET consumed_at=? WHERE token_hash=?").bind(nowIso(),await hashToken(raw)).run();return subscriber;
}

async function candidates(db,start,end){
  const result=await db.prepare(`SELECT c.*,COUNT(DISTINCT s.id) AS source_count,(SELECT COUNT(*) FROM content_views v WHERE v.content_id=c.id) AS views,(SELECT COUNT(*) FROM content_likes l WHERE l.content_id=c.id) AS likes,(SELECT COUNT(*) FROM saved_items f WHERE f.item_id=c.id) AS saves FROM content_items c LEFT JOIN content_sources s ON s.content_id=c.id WHERE c.status='published' AND c.published_at>=? AND c.published_at<? AND c.published_at<=? AND c.type IN ('article','brief') AND length(c.title)>4 AND length(COALESCE(NULLIF(c.summary,''),c.excerpt))>40 AND EXISTS(SELECT 1 FROM content_translations t WHERE t.content_id=c.id AND t.locale='en') AND EXISTS(SELECT 1 FROM content_translations t WHERE t.content_id=c.id AND t.locale='ar') AND EXISTS(SELECT 1 FROM content_translations_extra x WHERE x.content_id=c.id AND x.locale='es') AND EXISTS(SELECT 1 FROM content_translations_extra x WHERE x.content_id=c.id AND x.locale='pt') GROUP BY c.id ORDER BY c.published_at DESC`).bind(start,end,nowIso()).all();return result.results||[];
}

async function localizedItems(db,items,locale){
  if(locale==='fr')return items.map(item=>({...item,localized_title:item.title,localized_excerpt:item.excerpt,localized_summary:item.summary}));
  const table=locale==='es'||locale==='pt'?'content_translations_extra':'content_translations';const map=new Map();
  for(const item of items){const row=await db.prepare(`SELECT title,excerpt,summary FROM ${table} WHERE content_id=? AND locale=?`).bind(item.id,locale).first();if(row)map.set(item.id,row)}
  return items.filter(item=>map.has(item.id)).map(item=>({...item,localized_title:map.get(item.id).title,localized_excerpt:map.get(item.id).excerpt,localized_summary:map.get(item.id).summary}));
}

async function syncPending(env){
  const rows=await env.DB.prepare("SELECT * FROM newsletter_subscribers WHERE status='active' AND brevo_sync_status<>'synced' LIMIT 100").all();
  for(const subscriber of rows.results||[]){try{if(subscriber.brevo_previous_email)await deleteBrevoContact(env,subscriber.brevo_previous_email).catch(error=>{if(error.status!==404)throw error});const id=await syncBrevoContact(env,env.DB,subscriber);await env.DB.prepare("UPDATE newsletter_subscribers SET brevo_contact_id=COALESCE(?,brevo_contact_id),brevo_sync_status='synced',brevo_previous_email=NULL,updated_at=? WHERE id=?").bind(id,nowIso(),subscriber.id).run()}catch(error){console.error("newsletter_contact_retry_failed",subscriber.id,error.message)}}
}

function campaignStats(report){const global=report?.statistics?.globalStats||report?.globalStats||{};return {sent:Number(global.sent||0),delivered:Number(global.delivered||0),opens:Number(global.uniqueViews||global.viewed||0),clicks:Number(global.uniqueClicks||global.clickers||0),bounces:Number(global.hardBounces||0)+Number(global.softBounces||0),errors:Number(global.invalid||0)+Number(global.blocked||0),unsubscribes:Number(global.unsubscriptions||0)}}

export async function refreshEditionAnalytics(env,edition){
  if(!edition?.brevo_campaign_id)return edition;const report=await getBrevoCampaign(env,edition.brevo_campaign_id);const stats=campaignStats(report);await env.DB.prepare("UPDATE newsletter_editions SET sent_count=?,delivered_count=?,open_count=?,click_count=?,bounce_count=?,error_count=?,unsubscribe_count=?,updated_at=? WHERE id=?").bind(stats.sent,stats.delivered,stats.opens,stats.clicks,stats.bounces,stats.errors,stats.unsubscribes,nowIso(),edition.id).run();return {...edition,...stats};
}

export async function runWeeklyNewsletter(env,{date=new Date(),force=false,dryRun=false}={}){
  const timeZone=env.NEWSLETTER_TIMEZONE||"Africa/Casablanca";if(!force&&!newsletterDue(date,timeZone))return {skipped:"not_due"};
  const cycle=sundayCycle(date,timeZone);const lockToken=crypto.randomUUID(),now=nowIso(),lockExpiry=new Date(Date.now()+10*60000).toISOString();
  await env.DB.prepare("INSERT OR IGNORE INTO newsletter_runs(cycle_key,period_start,period_end,status,started_at,updated_at) VALUES(?,?,?,'PREPARING',?,?)").bind(cycle.cycleKey,cycle.periodStart,cycle.periodEnd,now,now).run();
  const lock=await env.DB.prepare("UPDATE newsletter_runs SET lock_token=?,lock_expires_at=?,updated_at=? WHERE cycle_key=? AND status NOT IN ('SENT','NO_CONTENT') AND (lock_token IS NULL OR lock_expires_at<?)").bind(lockToken,lockExpiry,now,cycle.cycleKey,now).run();
  if(Number(lock.meta?.changes||0)!==1)return {skipped:"locked_or_sent",cycleKey:cycle.cycleKey};
  try{
    await syncPending(env);const pool=await candidates(env.DB,cycle.periodStart,cycle.periodEnd);const selection=selectNewsletterItems(pool,{periodEnd:date.getTime()});
    if(!selection.items.length){await env.DB.prepare("UPDATE newsletter_runs SET status='NO_CONTENT',completed_at=?,lock_token=NULL,lock_expires_at=NULL,updated_at=? WHERE cycle_key=?").bind(nowIso(),nowIso(),cycle.cycleKey).run();return {cycleKey:cycle.cycleKey,status:"NO_CONTENT"}}
    const lists=dryRun?{}:await ensureBrevoLists(env,env.DB);const results=[];
    for(const locale of NEWSLETTER_LOCALES){let currentEdition=null;try{
      const all=await localizedItems(env.DB,[...selection.items,...(selection.exceptional?[selection.exceptional]:[])],locale);const main=all.slice(0,selection.items.length);const exceptional=selection.exceptional?all.find(item=>item.id===selection.exceptional.id):null;const copy=newsletterCopy[locale];const rendered=renderNewsletter({locale,items:main,exceptional,cycleKey:cycle.cycleKey,dateLabel:cycle.localDate,origin:env.PUBLIC_SITE_URL||env.PUBLIC_ORIGIN||"https://tamusni.pages.dev"});const editionKey=`${cycle.cycleKey}_${locale}`,editionId=crypto.randomUUID();const count=await env.DB.prepare("SELECT COUNT(*) AS count FROM newsletter_subscribers WHERE status='active' AND locale=? AND email_verified_at IS NOT NULL").bind(locale).first();
      await env.DB.prepare("INSERT OR IGNORE INTO newsletter_editions(id,edition_key,cycle_key,locale,period_start,period_end,subject,preheader,status,subscriber_count,html_hash,text_hash,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)").bind(editionId,editionKey,cycle.cycleKey,locale,cycle.periodStart,cycle.periodEnd,copy.subject,copy.preheader,dryRun?'READY':'PREPARING',Number(count?.count||0),await digest(rendered.html),await digest(rendered.text),nowIso(),nowIso()).run();
      const edition=await env.DB.prepare("SELECT * FROM newsletter_editions WHERE edition_key=?").bind(editionKey).first();currentEdition=edition;
      await env.DB.prepare("UPDATE newsletter_editions SET subscriber_count=?,updated_at=? WHERE id=?").bind(Number(count?.count||0),nowIso(),edition.id).run();
      if(!await env.DB.prepare("SELECT 1 FROM newsletter_edition_items WHERE edition_id=? LIMIT 1").bind(edition.id).first()){let position=1;for(const item of main){await env.DB.prepare("INSERT INTO newsletter_edition_items(edition_id,content_id,position,is_highlight,score) VALUES(?,?,?,?,?)").bind(edition.id,item.id,position++,0,item.score).run()}if(exceptional)await env.DB.prepare("INSERT INTO newsletter_edition_items(edition_id,content_id,position,is_highlight,score) VALUES(?,?,?,?,?)").bind(edition.id,exceptional.id,position,1,exceptional.score).run()}
      if(dryRun){results.push({locale,status:"READY",count:Number(count?.count||0),items:main.length+(exceptional?1:0)});continue}
      if(!Number(count?.count||0)){await env.DB.prepare("UPDATE newsletter_editions SET status='SKIPPED',updated_at=? WHERE id=?").bind(nowIso(),edition.id).run();results.push({locale,status:"SKIPPED",count:0});continue}
      let campaignId=edition.brevo_campaign_id;
      if(campaignId){const report=await getBrevoCampaign(env,campaignId);if(report.status==='sent'||report.status==='archive'){await env.DB.prepare("UPDATE newsletter_editions SET status='SENT',sent_at=COALESCE(sent_at,?),updated_at=? WHERE id=?").bind(nowIso(),nowIso(),edition.id).run();results.push({locale,status:"SENT",campaignId});continue}}
      if(!campaignId){const campaign=await createBrevoCampaign(env,{name:`${cycle.cycleKey} ${locale.toUpperCase()}`,subject:rendered.subject,preheader:rendered.preheader,html:rendered.html,listId:lists[locale],tag:cycle.cycleKey});campaignId=String(campaign.id);await env.DB.prepare("UPDATE newsletter_editions SET brevo_campaign_id=?,status='READY',attempt_count=attempt_count+1,updated_at=? WHERE id=?").bind(campaignId,nowIso(),edition.id).run()}
      await env.DB.prepare("UPDATE newsletter_editions SET status='SENDING',updated_at=? WHERE id=?").bind(nowIso(),edition.id).run();await sendBrevoCampaign(env,campaignId);await env.DB.prepare("UPDATE newsletter_editions SET status='SENT',sent_at=?,updated_at=? WHERE id=?").bind(nowIso(),nowIso(),edition.id).run();results.push({locale,status:"SENT",campaignId,count:Number(count.count)});
      }catch(error){console.error("newsletter_locale_failed",locale,error.message);if(currentEdition)await env.DB.prepare("UPDATE newsletter_editions SET status='FAILED',error_detail=?,updated_at=? WHERE id=?").bind(String(error.detail||error.message||error).slice(0,1000),nowIso(),currentEdition.id).run();results.push({locale,status:"FAILED",error:String(error.message||error)})}
    }
    const failed=results.some(item=>item.status==='FAILED');const status=dryRun?'READY':failed?'PARTIAL':'SENT';await env.DB.prepare("UPDATE newsletter_runs SET status=?,completed_at=?,lock_token=NULL,lock_expires_at=NULL,updated_at=? WHERE cycle_key=?").bind(status,nowIso(),nowIso(),cycle.cycleKey).run();return {cycleKey:cycle.cycleKey,status,selected:selection.items.map(item=>({id:item.id,score:item.score})),exceptional:selection.exceptional?.id||null,editions:results};
  }catch(error){await env.DB.prepare("UPDATE newsletter_runs SET status='FAILED',error_detail=?,completed_at=?,lock_token=NULL,lock_expires_at=NULL,updated_at=? WHERE cycle_key=? AND lock_token=?").bind(String(error.detail||error.message||error).slice(0,1000),nowIso(),nowIso(),cycle.cycleKey,lockToken).run();throw error}
}

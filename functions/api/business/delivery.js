import { cleanText, hashToken, json, readBody, sameOrigin } from "../../_lib/auth.js";

export async function onRequestPost(context){
  if(!sameOrigin(context.request))return json({error:"Origine refusée."},403);
  try{
    const body=await readBody(context.request,8_000);const campaignId=cleanText(body.campaignId,100);const eventType=body.eventType==="click"?"click":body.eventType==="impression"?"impression":"";const visitorId=cleanText(body.visitorId,100);const locale=["fr","ar","en","es","pt"].includes(body.locale)?body.locale:"fr";const pagePath=cleanText(body.pagePath,500);const deviceClass=["mobile","desktop","tablet"].includes(body.deviceClass)?body.deviceClass:"unknown";
    if(!campaignId||!eventType||visitorId.length<8||!pagePath.startsWith("/"))return json({error:"Événement invalide."},400);
    const campaign=await context.env.DB.prepare("SELECT id,languages_json FROM business_campaigns WHERE id=? AND status='active' AND (ends_at IS NULL OR ends_at>?)").bind(campaignId,new Date().toISOString()).first();if(!campaign)return json({error:"Campagne inactive."},404);
    let languages=[];try{languages=JSON.parse(campaign.languages_json||"[]");}catch{}if(!languages.includes(locale))return json({error:"Campagne non ciblée."},409);
    const now=new Date().toISOString();const metricDate=now.slice(0,10);const eventKey=await hashToken(`${campaignId}|${eventType}|${visitorId}|${metricDate}`);const id=crypto.randomUUID();
    const inserted=await context.env.DB.prepare("INSERT OR IGNORE INTO business_delivery_events(id,campaign_id,event_type,event_key,page_path,locale,device_class,visible_ms,created_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(id,campaignId,eventType,eventKey,pagePath,locale,deviceClass,eventType==="impression"?1000:null,now).run();
    if(Number(inserted.meta?.changes||0)>0){const impression=eventType==="impression"?1:0;const click=eventType==="click"?1:0;await context.env.DB.prepare("INSERT INTO business_campaign_metrics(campaign_id,metric_date,impressions_provisional,clicks_provisional,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(campaign_id,metric_date) DO UPDATE SET impressions_provisional=impressions_provisional+?,clicks_provisional=clicks_provisional+?,updated_at=?").bind(campaignId,metricDate,impression,click,now,impression,click,now).run();}
    return json({ok:true,duplicate:Number(inserted.meta?.changes||0)===0});
  }catch(error){console.error("business_delivery_failed",error);return json({error:"Mesure indisponible."},500);}
}

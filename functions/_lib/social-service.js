import { classifyFailure, formatSocialPost, nextAttemptAt, scheduleAt } from './social-core.js';

const now=()=>new Date().toISOString();
const safeDetail=value=>String(value||'').replace(/[\r\n\u0000-\u001f]/g,' ').slice(0,800);
async function event(env,publicationId,type,detail=''){await env.DB.prepare('INSERT INTO social_events(id,publication_id,event_type,detail,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(),publicationId,type,safeDetail(detail),now()).run()}
async function attempt(env,job,outcome,httpStatus=null,errorCode=null,detail=''){await env.DB.prepare('INSERT INTO social_attempts(id,publication_id,attempt_number,outcome,http_status,error_code,detail,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),job.id,Number(job.attempt_count||0)+1,outcome,httpStatus,errorCode,safeDetail(detail),now()).run()}

async function publishX(env,job){
  if(!env.X_USER_ACCESS_TOKEN)return {ok:false,status:401,code:'X_NOT_CONNECTED',detail:'Jeton X absent'};
  const response=await fetch('https://api.x.com/2/tweets',{method:'POST',headers:{Authorization:`Bearer ${env.X_USER_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({text:job.social_text}),signal:AbortSignal.timeout(20000)});
  const data=await response.json().catch(()=>({}));return response.ok?{ok:true,id:data.data?.id,url:data.data?.id?`https://x.com/i/web/status/${data.data.id}`:null}:{ok:false,status:response.status,code:data.type||'X_API_ERROR',detail:data.detail||data.title};
}
async function metaPost(env,path,params){const response=await fetch(`https://graph.facebook.com/${env.META_GRAPH_API_VERSION||'v24.0'}/${path}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(params),signal:AbortSignal.timeout(25000)});const data=await response.json().catch(()=>({}));return {response,data}}
async function publishFacebook(env,job){
  if(!env.META_PAGE_ACCESS_TOKEN||!env.META_PAGE_ID)return {ok:false,status:401,code:'FACEBOOK_NOT_CONNECTED',detail:'Page Facebook non connectée'};
  const {response,data}=await metaPost(env,`${env.META_PAGE_ID}/feed`,{message:job.social_text,link:job.canonical_url,access_token:env.META_PAGE_ACCESS_TOKEN});return response.ok?{ok:true,id:data.id,url:null}:{ok:false,status:response.status,code:data.error?.code||'META_API_ERROR',detail:data.error?.message};
}
async function publishInstagram(env,job){
  if(!env.META_PAGE_ACCESS_TOKEN||!env.INSTAGRAM_BUSINESS_ACCOUNT_ID)return {ok:false,status:401,code:'INSTAGRAM_NOT_CONNECTED',detail:'Compte Instagram professionnel non connecté'};
  if(!job.media_url)return {ok:false,status:422,code:'INSTAGRAM_MEDIA_REQUIRED',detail:'Instagram exige une image publique'};
  const imageUrl=new URL(job.media_url,env.PUBLIC_SITE_URL||'https://tamusni.pages.dev').href;
  const created=await metaPost(env,`${env.INSTAGRAM_BUSINESS_ACCOUNT_ID}/media`,{image_url:imageUrl,caption:job.social_text,access_token:env.META_PAGE_ACCESS_TOKEN});
  if(!created.response.ok)return {ok:false,status:created.response.status,code:created.data.error?.code||'META_API_ERROR',detail:created.data.error?.message};
  const published=await metaPost(env,`${env.INSTAGRAM_BUSINESS_ACCOUNT_ID}/media_publish`,{creation_id:created.data.id,access_token:env.META_PAGE_ACCESS_TOKEN});return published.response.ok?{ok:true,id:published.data.id,url:null}:{ok:false,status:published.response.status,code:published.data.error?.code||'META_API_ERROR',detail:published.data.error?.message};
}
async function adapter(env,job){if(job.platform==='x')return publishX(env,job);if(job.platform==='facebook')return publishFacebook(env,job);if(job.platform==='instagram')return publishInstagram(env,job);return {ok:false,status:422,code:'NOT_APPLICABLE',detail:'Aucune vraie vidéo à publier'};}

export async function prepareSocialJobs(env,limit=25){
  const origin=env.PUBLIC_SITE_URL||'https://tamusni.pages.dev';
  const result=await env.DB.prepare("SELECT p.*,c.slug,c.type,c.title,c.excerpt,c.summary,c.category,c.cover_url,c.media_url,c.published_at,a.mode FROM social_publications p JOIN content_items c ON c.id=p.content_id JOIN social_accounts a ON a.platform=p.platform WHERE p.status='PENDING' ORDER BY p.created_at LIMIT ?").bind(limit).all();
  for(const job of result.results||[]){const formatted=formatSocialPost(job,job.platform,origin);const stamp=now();if(!formatted.applicable){await env.DB.prepare("UPDATE social_publications SET status='SKIPPED',last_error_code='NOT_APPLICABLE',updated_at=? WHERE id=? AND status='PENDING'").bind(stamp,job.id).run();continue}const scheduled=scheduleAt(job.platform,job.published_at||stamp);await env.DB.prepare("UPDATE social_publications SET status=?,social_text=?,canonical_url=?,media_url=?,scheduled_for=?,updated_at=? WHERE id=? AND status='PENDING'").bind(job.mode==='AUTO'?'SCHEDULED':'READY',formatted.text,formatted.url,formatted.mediaUrl,scheduled,stamp,job.id).run();if(formatted.mediaUrl)await env.DB.prepare("INSERT OR IGNORE INTO social_media_assets(id,publication_id,source_url,platform,aspect_ratio,alt_text,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),job.id,formatted.mediaUrl,job.platform,job.platform==='instagram'?'4:5':'1.91:1',job.title,'READY',stamp,stamp).run();await event(env,job.id,'PREPARED',job.mode)}return result.results?.length||0;
}

export async function processSocialJobs(env,{limit=10,forceId=null}={}){
  const mode=String(env.SOCIAL_PUBLISHING_MODE||'test').toLowerCase();const stamp=now();
  const query=forceId?"SELECT p.* FROM social_publications p JOIN social_accounts a ON a.platform=p.platform WHERE p.id=? AND p.status IN ('READY','SCHEDULED','FAILED') AND a.mode<>'PAUSED'":"SELECT p.* FROM social_publications p JOIN social_accounts a ON a.platform=p.platform WHERE p.status IN ('SCHEDULED','FAILED') AND a.mode='AUTO' AND COALESCE(p.next_retry_at,p.scheduled_for)<=? ORDER BY COALESCE(p.next_retry_at,p.scheduled_for) LIMIT ?";
  const result=forceId?await env.DB.prepare(query).bind(forceId).all():await env.DB.prepare(query).bind(stamp,limit).all();
  for(const job of result.results||[]){
    if(mode!=='live'){await env.DB.prepare("UPDATE social_publications SET status='READY',updated_at=? WHERE id=?").bind(now(),job.id).run();await attempt(env,job,'DRY_RUN');await event(env,job.id,'DRY_RUN','No external request; SOCIAL_PUBLISHING_MODE is not live');continue}
    const lock=await env.DB.prepare("UPDATE social_publications SET status='PUBLISHING',updated_at=? WHERE id=? AND status IN ('READY','SCHEDULED','FAILED')").bind(stamp,job.id).run();if(!Number(lock.meta?.changes||0))continue;
    let response;try{response=await adapter(env,job)}catch(error){response={ok:false,status:503,code:'NETWORK_ERROR',detail:error.message}}
    if(response.ok){await env.DB.prepare("UPDATE social_publications SET status='PUBLISHED',external_id=?,external_url=?,published_at=?,updated_at=?,attempt_count=attempt_count+1,last_error_code=NULL,last_error_detail=NULL WHERE id=?").bind(response.id||null,response.url||null,now(),now(),job.id).run();await attempt(env,job,'SUCCESS',200);await event(env,job.id,'PUBLISHED',response.id||'')}
    else {const count=Number(job.attempt_count||0)+1,kind=classifyFailure(Number(response.status||500)),retry=kind==='retry'&&count<Number(job.max_attempts||4);await env.DB.prepare("UPDATE social_publications SET status='FAILED',attempt_count=?,next_retry_at=?,last_error_code=?,last_error_detail=?,updated_at=? WHERE id=?").bind(count,retry?nextAttemptAt(count):null,safeDetail(response.code),safeDetail(response.detail),now(),job.id).run();await attempt(env,job,retry?'RETRY':'PERMANENT_FAILURE',response.status,response.code,response.detail);await event(env,job.id,retry?'RETRY_SCHEDULED':'FAILED',response.code)}
  }
  return {mode,processed:result.results?.length||0};
}

export async function runSocialDistribution(env,options={}){const prepared=await prepareSocialJobs(env);const processed=await processSocialJobs(env,options);return {prepared,...processed};}

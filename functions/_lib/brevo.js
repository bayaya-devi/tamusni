const API="https://api.brevo.com/v3";
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

export async function brevoRequest(env,path,{method="GET",body,retries=2}={}){
  if(!env.BREVO_API_KEY)throw new Error("BREVO_NOT_CONFIGURED");
  for(let attempt=0;;attempt++){
    const response=await fetch(`${API}${path}`,{method,headers:{"api-key":env.BREVO_API_KEY,Accept:"application/json",...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
    if(response.ok)return response.status===204?null:response.json();
    const detail=(await response.text()).slice(0,500);
    if(attempt<retries&&(response.status===429||response.status>=500)){await wait(300*2**attempt);continue}
    const error=new Error(`BREVO_${response.status}`);error.detail=detail;error.status=response.status;throw error;
  }
}

async function setting(db,key){return (await db.prepare("SELECT value FROM newsletter_settings WHERE key=?").bind(key).first())?.value||null}
async function saveSetting(db,key,value){await db.prepare("INSERT INTO newsletter_settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(key,String(value),new Date().toISOString()).run()}

export async function ensureBrevoLists(env,db){
  const locales=["fr","ar","en","es","pt"],result={}; let complete=true;
  for(const locale of locales){const value=await setting(db,`brevo_list_${locale}`);if(value)result[locale]=Number(value);else complete=false}
  if(complete)return result;
  const folders=await brevoRequest(env,"/contacts/folders?limit=50&offset=0");let folder=(folders.folders||[]).find(item=>item.name==="TAMUSNI Newsletter");
  if(!folder)folder=await brevoRequest(env,"/contacts/folders",{method:"POST",body:{name:"TAMUSNI Newsletter"}});
  const lists=await brevoRequest(env,"/contacts/lists?limit=50&offset=0&sort=desc");
  for(const locale of locales){if(result[locale])continue;const name=`TAMUSNI Newsletter ${locale.toUpperCase()}`;let list=(lists.lists||[]).find(item=>item.name===name);if(!list)list=await brevoRequest(env,"/contacts/lists",{method:"POST",body:{name,folderId:Number(folder.id)}});result[locale]=Number(list.id);await saveSetting(db,`brevo_list_${locale}`,list.id)}
  return result;
}

export async function syncBrevoContact(env,db,subscriber){
  const lists=await ensureBrevoLists(env,db);const listIds=Object.values(lists);const activeId=lists[subscriber.locale]||lists.fr;
  const result=await brevoRequest(env,"/contacts",{method:"POST",body:{email:subscriber.email,listIds:[activeId],unlinkListIds:listIds.filter(id=>id!==activeId),updateEnabled:true}});
  return result?.id?String(result.id):null;
}
export const deleteBrevoContact=(env,email)=>brevoRequest(env,`/contacts/${encodeURIComponent(email)}`,{method:"DELETE",retries:1});

export async function createBrevoCampaign(env,payload){
  return brevoRequest(env,"/emailCampaigns",{method:"POST",body:{name:payload.name,subject:payload.subject,sender:{name:env.BREVO_SENDER_NAME||"TAMUSNI",email:env.BREVO_SENDER_EMAIL||"aetbconseil@gmail.com"},replyTo:"aetbconseil@gmail.com",recipients:{listIds:[payload.listId]},htmlContent:payload.html,previewText:payload.preheader,tag:payload.tag,mirrorActive:false,inlineImageActivation:false}});
}
export const sendBrevoCampaign=(env,id)=>brevoRequest(env,`/emailCampaigns/${encodeURIComponent(id)}/sendNow`,{method:"POST"});
export const getBrevoCampaign=(env,id)=>brevoRequest(env,`/emailCampaigns/${encodeURIComponent(id)}`);
export const getBrevoAccount=env=>brevoRequest(env,"/account",{retries:0});
export async function ensureBrevoMarketingWebhook(env,origin){
  if(!env.BREVO_WEBHOOK_SECRET)throw new Error("BREVO_WEBHOOK_SECRET_MISSING");const target=`${origin.replace(/\/$/,"")}/api/newsletter/webhook`;const current=await brevoRequest(env,"/webhooks?type=marketing&sort=desc");const found=(current.webhooks||[]).find(item=>item.url===target);const body={url:target,description:"TAMUSNI newsletter analytics",type:"marketing",events:["delivered","opened","click","hardBounce","softBounce","spam","unsubscribed"],headers:[{key:"x-tamusni-webhook-secret",value:env.BREVO_WEBHOOK_SECRET}],batched:false};if(found){await brevoRequest(env,`/webhooks/${found.id}`,{method:"PUT",body});return {id:found.id,created:false}}const created=await brevoRequest(env,"/webhooks",{method:"POST",body});return {id:created.id,created:true}
}

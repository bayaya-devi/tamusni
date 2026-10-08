import test from "node:test";
import assert from "node:assert/strict";
import { canAcquireNewsletterRun, newsletterClock, newsletterDue, normalizeNewsletterLocale, scoreNewsletterContent, selectNewsletterItems, sundayCycle } from "../functions/_lib/newsletter-core.js";
import { renderNewsletter } from "../functions/_lib/newsletter-template.js";
import { sendEmail } from "../functions/_lib/email.js";
import { onRequestPost as handleBrevoWebhook } from "../functions/api/newsletter/webhook.js";
import { ensureBrevoMarketingWebhook } from "../functions/_lib/brevo.js";

const item=(id,category="Innovation",score={})=>({id,slug:`story-${id}`,category,type:"article",title:`Story ${id}`,summary:"A complete and reliable summary with enough context for newsletter readers.",excerpt:"A complete excerpt for readers.",published_at:"2026-10-04T05:00:00.000Z",cover_url:"/images/editorial-battery.svg",source_count:2,views:score.views||0,likes:score.likes||0,saves:score.saves||0,fact_check_status:"verified",localized_title:`Localized ${id}`,localized_summary:"A localized and complete summary for this weekly edition."});

test("normalizes the five newsletter locales",()=>{for(const locale of ["fr","ar","en","es","pt"])assert.equal(normalizeNewsletterLocale(`${locale}-MA`),locale);assert.equal(normalizeNewsletterLocale("de"),"fr")});
test("detects Sunday 08:00 in Africa/Casablanca without a fixed offset",()=>{
  const start=Date.parse("2026-10-10T18:00:00Z");
  const candidates=Array.from({length:24*60},(_,minute)=>new Date(start+minute*60000));
  const dueInstant=candidates.find(date=>{const clock=newsletterClock(date);return clock.date==="2026-10-11"&&clock.hour===8&&clock.minute===5});
  const outsideWindow=candidates.find(date=>{const clock=newsletterClock(date);return clock.date==="2026-10-11"&&clock.hour===9&&clock.minute===5});
  assert.ok(dueInstant,"the runtime timezone database must expose Sunday 08:05 in Casablanca");
  assert.ok(outsideWindow,"the runtime timezone database must expose Sunday 09:05 in Casablanca");
  assert.equal(newsletterDue(dueInstant),true);
  assert.equal(newsletterDue(outsideWindow),false);
});
test("creates a stable weekly cycle key",()=>{const cycle=sundayCycle(new Date("2026-10-11T07:05:00Z"));assert.match(cycle.cycleKey,/^newsletter_2026-W\d{2}$/);assert.equal(cycle.localDate,"2026-10-11")});
test("selection keeps four main items, diversity and at most one exceptional item",()=>{const source=[item("a","Innovation",{views:40}),item("b","Innovation",{views:30}),item("c","Espace",{views:20}),item("d","Robotique",{views:10}),item("e","Cybersécurité",{views:100}),item("f","Intelligence artificielle",{views:1})];const result=selectNewsletterItems(source,{periodEnd:Date.parse("2026-10-11T08:00:00Z"),exceptionalThreshold:0});assert.equal(result.items.length,4);assert.ok(result.exceptional);assert.ok(!result.items.some(x=>x.id===result.exceptional.id))});
test("content score is deterministic and based on real fields",()=>assert.equal(scoreNewsletterContent(item("a"),Date.parse("2026-10-11T08:00:00Z")),scoreNewsletterContent(item("a"),Date.parse("2026-10-11T08:00:00Z"))));
test("sent and currently locked runs cannot be acquired twice",()=>{assert.equal(canAcquireNewsletterRun("SENT",null),false);assert.equal(canAcquireNewsletterRun("PREPARING",new Date(Date.now()+60000).toISOString()),false);assert.equal(canAcquireNewsletterRun("FAILED",new Date(Date.now()-60000).toISOString()),true)});
test("email generator emits responsive HTML, text parity, five-item cap and Arabic RTL",()=>{const items=[1,2,3,4,5].map(n=>item(String(n)));const output=renderNewsletter({locale:"ar",items,exceptional:item("x","Espace"),cycleKey:"newsletter_2026-W41",dateLabel:"2026-10-11",origin:"https://tamusni.pages.dev"});assert.match(output.html,/<html lang="ar" dir="rtl">/);assert.match(output.html,/width="600"/);assert.match(output.html,/\{\{ unsubscribe \}\}/);assert.match(output.text,/https:\/\/tamusni\.pages\.dev\/ar\/articles\/story-1\//);assert.equal((output.html.match(/class="[^"]*tm-card[^"]*"/g)||[]).length,1);assert.doesNotMatch(output.html,/Story 5/);assert.match(output.html,/Localized x/)});
test("Brevo transactional email includes a validated PDF attachment",async()=>{const original=globalThis.fetch;let payload=null;globalThis.fetch=async(_url,options)=>{payload=JSON.parse(options.body);return new Response(JSON.stringify({messageId:"test"}),{status:201,headers:{"content-type":"application/json"}})};try{assert.equal(await sendEmail({BREVO_API_KEY:"test",BREVO_SENDER_EMAIL:"sender@example.com"},{to:"recipient@example.com",subject:"Report",html:"<p>Report</p>",text:"Report",attachments:[{name:"TAMUSNI_Maintenance_2026-10-08.pdf",content:"JVBERi0xLjQ="}]}),"brevo");assert.equal(payload.attachment[0].name,"TAMUSNI_Maintenance_2026-10-08.pdf");assert.equal(payload.attachment[0].content,"JVBERi0xLjQ=")}finally{globalThis.fetch=original}});

function webhookContext({changes=1,token="secret",event="unsubscribed"}={}){
  const calls=[];
  const DB={prepare(sql){return {bind(...values){calls.push({sql,values});return {run:async()=>({meta:{changes}})}}}}};
  return {context:{request:new Request(`https://tamusni.pages.dev/api/newsletter/webhook?token=${token}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id:42,event,email:"Reader@Example.com",camp_id:7,ts_event:1791450000})}),env:{DB,BREVO_WEBHOOK_SECRET:"secret"}},calls};
}

test("Brevo unsubscribed webhook disables the subscriber once",async()=>{const {context,calls}=webhookContext();const response=await handleBrevoWebhook(context);assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true,duplicate:false});assert.equal(calls.length,2);assert.match(calls[1].sql,/status='unsubscribed'/);assert.equal(calls[1].values.at(-1),"reader@example.com")});
test("duplicate Brevo webhook is acknowledged without replaying side effects",async()=>{const {context,calls}=webhookContext({changes:0,event:"unsubscribe"});const response=await handleBrevoWebhook(context);assert.deepEqual(await response.json(),{ok:true,duplicate:true});assert.equal(calls.length,1);assert.equal(calls[0].values[2],"unsubscribed")});
test("Brevo webhook rejects an invalid secret without touching the database",async()=>{const {context,calls}=webhookContext({token:"wrong"});const response=await handleBrevoWebhook(context);assert.equal(response.status,404);assert.equal(calls.length,0)});
test("Brevo webhook updates only fields accepted by the update endpoint",async()=>{const original=globalThis.fetch;let updateBody=null;globalThis.fetch=async(url,options={})=>{if(String(url).includes("/webhooks?"))return Response.json({webhooks:[{id:9,url:"https://tamusni.pages.dev/api/newsletter/webhook?token=hook-secret&v=2"}]});updateBody=JSON.parse(options.body);return new Response(null,{status:204})};try{const result=await ensureBrevoMarketingWebhook({BREVO_API_KEY:"api-key",BREVO_WEBHOOK_SECRET:"hook-secret"},"https://tamusni.pages.dev");assert.deepEqual(result,{id:9,created:false});assert.equal(updateBody.type,undefined);assert.equal(updateBody.channel,undefined);assert.equal(updateBody.batched,undefined);assert.deepEqual(updateBody.events,["delivered","opened","click","hardBounce","softBounce","spam","unsubscribed"])}finally{globalThis.fetch=original}});

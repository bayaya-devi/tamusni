import test from "node:test";
import assert from "node:assert/strict";
import { createSessionCookie } from "../functions/_lib/auth.js";
import { onRequestGet as getContributorSubmissions, onRequestPost as postContributorSubmission } from "../functions/api/contributor/submissions.js";
import { onRequestGet as getAdminAnalytics } from "../functions/api/admin/analytics.js";

function makeContext(role, { submission = null, ownerItem = null } = {}) {
  const writes=[];
  const db={
    prepare(sql){const statement={sql,params:[],bind(...params){this.params=params;return this},async first(){
      if(sql.includes("CASE WHEN u.role='ADMIN'"))return {id:"user-1",name:"Test Contributor",email:"test@example.invalid",role,is_banned:0,email_verified_at:"2026-01-01T00:00:00.000Z"};
      if(sql.includes("SELECT id,status FROM contributor_submissions"))return submission;
      if(sql.includes("WHERE id=? AND owner_user_id=?"))return ownerItem;
      if(sql.includes("SELECT COUNT(*)"))return {count:0};
      return null;
    },async all(){return {results:[]}},async run(){writes.push({sql,params:this.params});return {meta:{changes:1}}}};return statement},async batch(statements){writes.push(...statements);return statements.map(()=>({meta:{changes:1}}))}};
  return {writes,context:async request=>({request,env:{DB:db,SESSION_SECRET:"test-only-session-secret-not-for-production"},params:{}})};
}

async function requestFor(role, path, { method="GET", body }={}) {
  const {context,writes}=makeContext(role,role==='CONTRIBUTOR'&&body?.id?{submission:body?.id==='sent-id'?{id:'sent-id',status:'submitted'}:null}:{});
  const cookie=await createSessionCookie({id:"user-1",name:"Test Contributor",email:"test@example.invalid",role},"test-only-session-secret-not-for-production");
  const request=new Request(`https://tamusni.test${path}`,{method,headers:{cookie:cookie.split(";")[0],...(body?{"content-type":"application/json"}:{})},body:body?JSON.stringify(body):undefined});
  const ctx=await context(request);
  const handler=path.startsWith('/api/admin/analytics')?getAdminAnalytics:method==='POST'?postContributorSubmission:getContributorSubmissions;
  return {response:await handler(ctx),writes};
}

test("ordinary USER cannot enter contributor submission APIs",async()=>{
  const {response}=await requestFor("USER","/api/contributor/submissions");
  assert.equal(response.status,403);
});

test("CONTRIBUTOR cannot enter admin analytics",async()=>{
  const {response}=await requestFor("CONTRIBUTOR","/api/admin/analytics");
  assert.equal(response.status,403);
});

test("an incomplete submission is rejected before any write",async()=>{
  const {response,writes}=await requestFor("CONTRIBUTOR","/api/contributor/submissions",{method:"POST",body:{action:"submit",type:"article",category:"Innovation",title:"Une proposition test suffisamment précise",excerpt:"",body:"texte trop court"}});
  assert.equal(response.status,400);
  assert.match((await response.json()).error,/chapô|image|source|article/i);
  assert.equal(writes.length,0);
});

test("a submitted proposal is immutable to its contributor",async()=>{
  const {response,writes}=await requestFor("CONTRIBUTOR","/api/contributor/submissions",{method:"POST",body:{id:"sent-id",action:"draft",type:"article",category:"Innovation",title:"Tentative de modification",body:"texte modifié"}});
  assert.equal(response.status,409);
  assert.equal(writes.length,0);
});

test("contributors cannot enumerate another contributor's submission",async()=>{
  const {context}=makeContext("CONTRIBUTOR");
  const cookie=await createSessionCookie({id:"user-1",name:"Test",email:"test@example.invalid",role:"CONTRIBUTOR"},"test-only-session-secret-not-for-production");
  const response=await getContributorSubmissions(await context(new Request("https://tamusni.test/api/contributor/submissions?id=foreign-id",{headers:{cookie:cookie.split(";")[0]}})));
  assert.equal(response.status,404);
});

test("ADMIN can access analytics built from real metric queries",async()=>{
  const {response}=await requestFor("ADMIN","/api/admin/analytics");
  assert.equal(response.status,200);
  const result=await response.json();
  assert.deepEqual(result.totals,{views:0,likes:0,favorites:0});
});

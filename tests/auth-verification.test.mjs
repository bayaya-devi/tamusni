import test from "node:test";
import assert from "node:assert/strict";
import { createSessionCookie, hashPassword, requireSession } from "../functions/_lib/auth.js";
import { onRequestPost as login } from "../functions/api/auth/login.js";
import { onRequestPost as register } from "../functions/api/auth/register.js";
import { onRequestGet as oauth } from "../functions/api/auth/oauth.js";
import { onRequestPost as verifyEmail } from "../functions/api/auth/verify-email.js";
import { createOtpChallenge } from "../functions/_lib/account-security.js";

const secret="test-only-session-secret-not-for-production";

function dbFor(user){
  return {prepare(sql){return {params:[],bind(...params){this.params=params;return this},async first(){
    if(sql.includes("FROM login_attempts"))return null;
    if(sql.includes("FROM users u LEFT JOIN"))return user;
    return null;
  },async run(){return {meta:{changes:1}}}}}};
}

function verificationDb(user){
  const challenges=[];
  const statement=(sql,args=[])=>({bind(...values){return statement(sql,values)},async first(){
    if(sql.includes("SELECT attempts,window_started_at"))return {attempts:1,blocked_until:null};
    if(sql.includes("SELECT id,code_hash"))return challenges.find(item=>item.user_id===args[0]&&item.purpose===args[1])||null;
    if(sql.includes("SELECT sent_at"))return null;
    if(sql.includes("FROM users WHERE email"))return String(args[0]).toLowerCase()===user.email?user:null;
    return null;
  },async run(){
    if(sql.startsWith("DELETE FROM account_challenges")){for(let index=challenges.length-1;index>=0;index-=1)if(challenges[index].user_id===args[0]&&challenges[index].purpose===args[1])challenges.splice(index,1);}
    else if(sql.startsWith("INSERT INTO account_challenges"))challenges.push({id:args[0],user_id:args[1],purpose:args[2],code_hash:args[3],expires_at:args[4],attempts:args[5],max_attempts:args[6],consumed_at:null,created_at:args[7],sent_at:args[8]});
    else if(sql.includes("SET attempts=attempts+1")){const challenge=challenges.find(item=>item.id===args[0]);if(challenge)challenge.attempts+=1;}
    else if(sql.includes("SET consumed_at")){const challenge=challenges.find(item=>item.id===args[1]);if(!challenge||challenge.consumed_at)return {meta:{changes:0}};challenge.consumed_at=args[0];return {meta:{changes:1}};}
    else if(sql.includes("UPDATE users SET email_verified_at"))user.email_verified_at=args[0];
    return {meta:{changes:1}};
  }});
  return {prepare:sql=>statement(sql),async batch(statements){for(const item of statements)await item.run();}};
}

test("password login refuses an unverified email without issuing a session",async()=>{
  const password="secret1",password_hash=await hashPassword(password);
  const user={id:"unverified",name:"Unverified",email:"pending@example.invalid",password_hash,role:"USER",additional_role:null,mfa_enabled:0,is_banned:0,email_verified_at:null};
  const request=new Request("https://tamusni.test/api/auth/login",{method:"POST",headers:{origin:"https://tamusni.test","content-type":"application/json"},body:JSON.stringify({email:user.email,password})});
  const response=await login({request,env:{DB:dbFor(user),SESSION_SECRET:secret}});
  assert.equal(response.status,403);
  assert.equal((await response.json()).code,"EMAIL_NOT_VERIFIED");
  assert.equal(response.headers.has("set-cookie"),false);
});

test("a previously issued session no longer authorizes an unverified account",async()=>{
  const user={id:"unverified",name:"Unverified",email:"pending@example.invalid",role:"USER",is_banned:0,email_verified_at:null};
  const cookie=await createSessionCookie(user,secret);
  const request=new Request("https://tamusni.test/api/account",{headers:{cookie:cookie.split(";")[0]}});
  assert.equal(await requireSession({request,env:{DB:dbFor(user),SESSION_SECRET:secret}}),null);
});

test("a verified account remains authorized",async()=>{
  const user={id:"verified",name:"Verified",email:"verified@example.invalid",role:"USER",is_banned:0,email_verified_at:"2026-01-01T00:00:00.000Z"};
  const cookie=await createSessionCookie(user,secret);
  const request=new Request("https://tamusni.test/api/account",{headers:{cookie:cookie.split(";")[0]}});
  assert.equal((await requireSession({request,env:{DB:dbFor(user),SESSION_SECRET:secret}}))?.sub,"verified");
});

test("registration accepts the official six-character password minimum",async()=>{
  const base={firstName:"Ada",lastName:"Test",email:"ada@example.invalid",preferredTopics:["Intelligence artificielle"],termsAccepted:true,locale:"fr"};
  const requestFor=password=>new Request("https://tamusni.test/api/auth/register",{method:"POST",headers:{origin:"https://tamusni.test","content-type":"application/json"},body:JSON.stringify({...base,password})});
  const env={DB:dbFor(null)};
  const short=await register({request:requestFor("abcde"),env});
  const accepted=await register({request:requestFor("abcdef"),env});
  assert.equal(short.status,400);
  assert.match((await short.json()).error,/6 caractères/);
  assert.equal(accepted.status,503);
});

test("Google OAuth callback stays on the localized public route",async()=>{
  const request=new Request("https://tamusni.pages.dev/api/auth/oauth?provider=google&intent=signup&locale=ar&newsletter=1");
  const response=await oauth({request,env:{OAUTH_GOOGLE_ENABLED:"true",PUBLIC_SITE_URL:"https://tamusni.pages.dev",SUPABASE_URL:"https://project.supabase.co"}});
  assert.equal(response.status,302);
  const callback=new URL(new URL(response.headers.get("location")).searchParams.get("redirect_to"));
  assert.equal(callback.href,"https://tamusni.pages.dev/ar/inscription/?oauth=google&newsletter=1");
});

test("email verification creates a session and opens the new account",async()=>{
  const user={id:"new-user",name:"New User",email:"new@example.invalid",role:"USER",session_version:1,email_verified_at:null,preferred_language:"fr"};
  const DB=verificationDb(user),env={DB,SESSION_SECRET:secret};
  const challenge=await createOtpChallenge({env},user.id,"EMAIL_VERIFICATION");
  const request=new Request("https://tamusni.test/api/auth/verify-email",{method:"POST",headers:{origin:"https://tamusni.test","content-type":"application/json"},body:JSON.stringify({email:user.email,code:challenge.code,locale:"fr"})});
  const response=await verifyEmail({request,env});
  assert.equal(response.status,200);
  assert.equal((await response.json()).redirect,"/fr/mon-espace/");
  assert.match(response.headers.get("set-cookie")||"",/^tamusni_session=/);
});

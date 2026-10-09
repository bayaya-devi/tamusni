import test from "node:test";
import assert from "node:assert/strict";
import { createSessionCookie, hashPassword, requireSession } from "../functions/_lib/auth.js";
import { onRequestPost as login } from "../functions/api/auth/login.js";
import { onRequestPost as register } from "../functions/api/auth/register.js";
import { onRequestGet as oauth } from "../functions/api/auth/oauth.js";

const secret="test-only-session-secret-not-for-production";

function dbFor(user){
  return {prepare(sql){return {params:[],bind(...params){this.params=params;return this},async first(){
    if(sql.includes("FROM login_attempts"))return null;
    if(sql.includes("FROM users u LEFT JOIN"))return user;
    return null;
  },async run(){return {meta:{changes:1}}}}}};
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

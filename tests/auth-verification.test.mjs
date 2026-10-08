import test from "node:test";
import assert from "node:assert/strict";
import { createSessionCookie, hashPassword, requireSession } from "../functions/_lib/auth.js";
import { onRequestPost as login } from "../functions/api/auth/login.js";

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

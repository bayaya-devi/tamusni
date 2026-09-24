import { hashToken } from "./auth.js";
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base64Url(bytes) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,""); }
function fromBase64Url(value) { const normalized=value.replace(/-/g,"+").replace(/_/g,"/"); return Uint8Array.from(atob(normalized+"=".repeat((4-normalized.length%4)%4)),(char)=>char.charCodeAt(0)); }

export function generateMfaSecret() {
  const bytes=crypto.getRandomValues(new Uint8Array(20)); let bits=0,value=0,output="";
  for(const byte of bytes){value=(value<<8)|byte;bits+=8;while(bits>=5){output+=alphabet[(value>>>(bits-5))&31];bits-=5;}}
  if(bits>0)output+=alphabet[(value<<(5-bits))&31]; return output;
}

function decodeBase32(input) {
  const clean=String(input).toUpperCase().replace(/[^A-Z2-7]/g,""); let bits=0,value=0,bytes=[];
  for(const char of clean){const index=alphabet.indexOf(char);if(index<0)continue;value=(value<<5)|index;bits+=5;if(bits>=8){bytes.push((value>>>(bits-8))&255);bits-=8;}}
  return new Uint8Array(bytes);
}

async function encryptionKey(secret) {
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw",digest,"AES-GCM",false,["encrypt","decrypt"]);
}

export async function encryptMfaSecret(secret,sessionSecret) {
  const iv=crypto.getRandomValues(new Uint8Array(12)); const key=await encryptionKey(sessionSecret);
  const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv},key,new TextEncoder().encode(secret));
  return `v1.${base64Url(iv)}.${base64Url(new Uint8Array(encrypted))}`;
}

export async function decryptMfaSecret(value,sessionSecret) {
  const [version,iv,cipher]=String(value||"").split("."); if(version!=="v1"||!iv||!cipher)throw new Error("MFA_SECRET_INVALID");
  const key=await encryptionKey(sessionSecret); const clear=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromBase64Url(iv)},key,fromBase64Url(cipher));
  return new TextDecoder().decode(clear);
}

async function totpAt(secret,counter) {
  const key=await crypto.subtle.importKey("raw",decodeBase32(secret),{name:"HMAC",hash:"SHA-1"},false,["sign"]);
  const buffer=new ArrayBuffer(8); new DataView(buffer).setBigUint64(0,BigInt(counter));
  const digest=new Uint8Array(await crypto.subtle.sign("HMAC",key,buffer)); const offset=digest[digest.length-1]&15;
  const number=((digest[offset]&127)<<24)|(digest[offset+1]<<16)|(digest[offset+2]<<8)|digest[offset+3];
  return String(number%1_000_000).padStart(6,"0");
}

export async function verifyTotp(secret,code,now=Date.now()) {
  const supplied=String(code||"").replace(/\s/g,""); if(!/^\d{6}$/.test(supplied))return false;
  const counter=Math.floor(now/30000); let match=0;
  for(const drift of [-1,0,1]){const expected=await totpAt(secret,counter+drift);let difference=0;for(let i=0;i<6;i++)difference|=expected.charCodeAt(i)^supplied.charCodeAt(i);match|=difference===0?1:0;}
  return match===1;
}

export async function recordAuthEvent(context,{userId=null,email="",event,suspicious=false}) {
  const request=context.request; const ipHash=await hashToken(request.headers.get("CF-Connecting-IP")||"unknown"); const emailHash=await hashToken(String(email).toLowerCase()); const agentHash=await hashToken(request.headers.get("User-Agent")||"unknown");
  let flagged=suspicious;
  if(event==="login_success"&&userId){const previous=await context.env.DB.prepare("SELECT ip_hash FROM auth_events WHERE user_id=? AND event IN ('login_success','oauth_success') ORDER BY created_at DESC LIMIT 1").bind(userId).first();flagged=Boolean(previous&&previous.ip_hash!==ipHash);}
  const now=new Date().toISOString();
  await context.env.DB.prepare("INSERT INTO auth_events(id,user_id,email_hash,ip_hash,user_agent_hash,country,event,suspicious,created_at) VALUES(?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),userId,emailHash,ipHash,agentHash,String(request.cf?.country||"").slice(0,2)||null,event,flagged?1:0,now).run();
  if(flagged&&userId)await context.env.DB.prepare("INSERT INTO notifications(id,user_id,title,url,created_at) VALUES(?,?,?,?,?)").bind(crypto.randomUUID(),userId,"Nouvelle connexion détectée","/compte/",now).run();
}

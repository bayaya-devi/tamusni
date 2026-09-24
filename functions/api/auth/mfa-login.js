import { clearMfaChallengeCookie, createSessionCookie, getMfaChallenge, hashToken, json, readBody, sameOrigin } from "../../_lib/auth.js";
import { decryptMfaSecret, recordAuthEvent, verifyTotp } from "../../_lib/mfa.js";

export async function onRequestPost(context) {
  if (!sameOrigin(context.request)) return json({ error: "Origine refusée." },403);
  try {
    const challenge=await getMfaChallenge(context.request,context.env.SESSION_SECRET); if(!challenge)return json({error:"La vérification a expiré. Reconnectez-vous."},401,{"Set-Cookie":clearMfaChallengeCookie()});
    const user=await context.env.DB.prepare("SELECT id,name,email,role,mfa_enabled,mfa_secret FROM users WHERE id=?").bind(challenge.sub).first();
    if(!user||!user.mfa_enabled||!user.mfa_secret)return json({error:"Double authentification indisponible."},401,{"Set-Cookie":clearMfaChallengeCookie()});
    const attemptKey=await hashToken(`mfa|${context.request.headers.get("CF-Connecting-IP")||"unknown"}|${user.id}`); const now=Date.now();
    const attempt=await context.env.DB.prepare("SELECT attempts,window_started_at,blocked_until FROM login_attempts WHERE key_hash=?").bind(attemptKey).first();
    if(attempt?.blocked_until&&Date.parse(attempt.blocked_until)>now)return json({error:"Trop de codes incorrects. Réessayez dans quinze minutes."},429,{"Retry-After":"900"});
    const {code}=await readBody(context.request); const secret=await decryptMfaSecret(user.mfa_secret,context.env.SESSION_SECRET);
    if(!await verifyTotp(secret,code)){
      const within=attempt?.window_started_at&&now-Date.parse(attempt.window_started_at)<900_000;const attempts=within?Number(attempt.attempts||0)+1:1;const blocked=attempts>=5?new Date(now+900_000).toISOString():null;
      await context.env.DB.prepare("INSERT INTO login_attempts(key_hash,attempts,window_started_at,blocked_until) VALUES(?,?,?,?) ON CONFLICT(key_hash) DO UPDATE SET attempts=excluded.attempts,window_started_at=excluded.window_started_at,blocked_until=excluded.blocked_until").bind(attemptKey,attempts,within?attempt.window_started_at:new Date(now).toISOString(),blocked).run();
      try{await recordAuthEvent(context,{userId:user.id,email:user.email,event:"mfa_failure"})}catch{} return json({error:"Code incorrect."},401);
    }
    await context.env.DB.prepare("DELETE FROM login_attempts WHERE key_hash=?").bind(attemptKey).run(); try{await recordAuthEvent(context,{userId:user.id,email:user.email,event:"login_success"})}catch{}
    return json({ok:true,redirect:user.role==="ADMIN"?"/admin/":"/compte/"},200,{"Set-Cookie":await createSessionCookie(user,context.env.SESSION_SECRET)});
  } catch(error){console.error("mfa_login_failed",error);return json({error:"Vérification impossible."},500)}
}

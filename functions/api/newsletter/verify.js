import { hashToken } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const url=new URL(context.request.url); const token=String(url.searchParams.get("token")||""); const redirect=new URL("/?newsletter=invalid#newsletter-section",url.origin);
  if(!token)return Response.redirect(redirect,302);
  try { const row=await context.env.DB.prepare("SELECT email,expires_at FROM newsletter_verification_tokens WHERE token_hash=?").bind(await hashToken(token)).first(); if(!row||Date.parse(row.expires_at)<Date.now())return Response.redirect(redirect,302); await context.env.DB.batch([context.env.DB.prepare("UPDATE newsletter_subscribers SET email_verified_at=COALESCE(email_verified_at,?) WHERE email=?").bind(new Date().toISOString(),row.email),context.env.DB.prepare("DELETE FROM newsletter_verification_tokens WHERE email=?").bind(row.email)]); return Response.redirect(new URL("/?newsletter=success#newsletter-section",url.origin),302); } catch(error) { console.error("newsletter_verify_failed",error); return Response.redirect(redirect,302); }
}

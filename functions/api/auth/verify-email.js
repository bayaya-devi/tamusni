import { hashToken } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url); const token = String(url.searchParams.get("token") || ""); const locale=["fr","ar","en","es","pt"].includes(url.searchParams.get("locale"))?url.searchParams.get("locale"):"fr";
  const redirect = new URL(`/${locale}/connexion/?verification=invalid`, url.origin);
  if (!token) return Response.redirect(redirect, 302);
  try {
    const tokenHash = await hashToken(token);
    const row = await context.env.DB.prepare("SELECT user_id,expires_at FROM email_verification_tokens WHERE token_hash=?").bind(tokenHash).first();
    if (!row || Date.parse(row.expires_at) < Date.now()) return Response.redirect(redirect, 302);
    const now = new Date().toISOString();
    await context.env.DB.batch([context.env.DB.prepare("UPDATE users SET email_verified_at=COALESCE(email_verified_at,?) WHERE id=?").bind(now,row.user_id),context.env.DB.prepare("DELETE FROM email_verification_tokens WHERE user_id=?").bind(row.user_id)]);
    return Response.redirect(new URL(`/${locale}/connexion/?verification=success`,url.origin),302);
  } catch (error) { console.error("verify_email_failed",error); return Response.redirect(redirect,302); }
}

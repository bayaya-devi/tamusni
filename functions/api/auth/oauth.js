import { json } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url); const provider = url.searchParams.get("provider"); const intent = url.searchParams.get("intent");
  if (!new Set(["google", "apple"]).has(provider)) return json({ error: "Fournisseur invalide." }, 400);
  if (context.env[`OAUTH_${provider.toUpperCase()}_ENABLED`] !== "true") return json({ error: `${provider === "google" ? "Google" : "Apple"} doit encore être activé dans Supabase.` }, 503);
  const siteOrigin = (context.env.PUBLIC_SITE_URL || url.origin).replace(/\/$/, "");
  const locale = new Set(["fr", "ar", "en", "es", "pt"]).has(url.searchParams.get("locale")) ? url.searchParams.get("locale") : "fr";
  const params = new URLSearchParams({ oauth: provider });
  if (url.searchParams.get("newsletter") === "1") params.set("newsletter", "1");
  const redirectTo = `${siteOrigin}/${locale}/${intent === "signup" ? "inscription" : "connexion"}/?${params}`;
  return Response.redirect(`${context.env.SUPABASE_URL}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectTo)}`, 302);
}

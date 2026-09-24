import { json } from "../../_lib/auth.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url); const provider = url.searchParams.get("provider");
  if (!new Set(["google", "apple"]).has(provider)) return json({ error: "Fournisseur invalide." }, 400);
  if (context.env[`OAUTH_${provider.toUpperCase()}_ENABLED`] !== "true") return json({ error: `${provider === "google" ? "Google" : "Apple"} doit encore être activé dans Supabase.` }, 503);
  const redirectTo = `${url.origin}/connexion/`;
  return Response.redirect(`${context.env.SUPABASE_URL}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectTo)}`, 302);
}

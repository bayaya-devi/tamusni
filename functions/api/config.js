import { json } from "../_lib/auth.js";

export async function onRequestGet(context) {
  return json({
    supabase: Boolean(context.env.SUPABASE_URL && context.env.SUPABASE_ANON_KEY),
    oauth: { google: context.env.OAUTH_GOOGLE_ENABLED === "true", apple: context.env.OAUTH_APPLE_ENABLED === "true" }
  });
}

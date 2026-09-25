import { json } from "../_lib/auth.js";
import { supabaseHealth } from "../_lib/supabase.js";

export async function onRequestGet(context) {
  const d1 = Boolean(await context.env.DB.prepare("SELECT 1 AS ok").first());
  const supabase = await supabaseHealth(context.env);
  return json({
    ok: d1 && supabase,
    architecture: "cloudflare-supabase",
    cloudflare: { d1, functions: true, role: "runtime-content-engagement" },
    supabase: { available: supabase, role: "auth-user-data-mirror" },
    checkedAt: new Date().toISOString()
  }, d1 && supabase ? 200 : 503);
}

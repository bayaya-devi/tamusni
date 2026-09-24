function configured(env) { return Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY); }

async function request(env, table, { method = "GET", query = "", body, prefer = "return=minimal" } = {}) {
  if (!configured(env)) throw new Error("SUPABASE_NOT_CONFIGURED");
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json", Prefer: prefer },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`SUPABASE_${response.status}:${await response.text()}`);
  return response;
}

export async function mirrorUser(env, user) { return request(env, "tamusni_users", { method: "POST", query: "?on_conflict=id", prefer: "resolution=merge-duplicates,return=minimal", body: { id: user.id, name: user.name, email: user.email, role: user.role, created_at: user.created_at || new Date().toISOString() } }); }
export async function mirrorNewsletter(env, email, locale) { return request(env, "tamusni_newsletter_subscribers", { method: "POST", query: "?on_conflict=email", prefer: "resolution=merge-duplicates,return=minimal", body: { email, locale } }); }
export async function mirrorFavorite(env, item) { return request(env, "tamusni_saved_items", { method: "POST", query: "?on_conflict=user_id,item_id", prefer: "resolution=merge-duplicates,return=minimal", body: item }); }
export async function removeMirroredFavorite(env, userId, itemId) { return request(env, "tamusni_saved_items", { method: "DELETE", query: `?user_id=eq.${encodeURIComponent(userId)}&item_id=eq.${encodeURIComponent(itemId)}` }); }
export async function supabaseHealth(env) { if (!configured(env)) return false; try { await request(env, "tamusni_users", { method: "GET", query: "?select=id&limit=1" }); return true; } catch { return false; } }

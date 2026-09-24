import { json } from "../_lib/auth.js";

export async function onRequestGet(context) {
  const result = await context.env.DB.prepare("SELECT title, category, url, display_time, published_at FROM live_updates WHERE active = 1 ORDER BY published_at DESC LIMIT 8").all();
  return json({ items: result.results || [], updatedAt: new Date().toISOString() }, 200, { "Cache-Control": "public, max-age=60, s-maxage=60" });
}

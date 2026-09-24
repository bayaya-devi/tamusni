const xml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
export async function onRequestGet(context) {
  const origin = new URL(context.request.url).origin;
  const result = await context.env.DB.prepare("SELECT slug,title,excerpt,published_at FROM content_items WHERE status='published' AND published_at<=? ORDER BY published_at DESC LIMIT 30").bind(new Date().toISOString()).all();
  const items = (result.results || []).map((item) => `<item><title>${xml(item.title)}</title><link>${xml(`${origin}/articles/${item.slug}`)}</link><guid>${xml(`${origin}/articles/${item.slug}`)}</guid><description>${xml(item.excerpt)}</description><pubDate>${new Date(item.published_at).toUTCString()}</pubDate></item>`).join("");
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>TAMUSNI</title><link>${xml(origin)}</link><description>Technologies, sciences et futur</description><language>fr</language>${items}</channel></rss>`, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=900" } });
}

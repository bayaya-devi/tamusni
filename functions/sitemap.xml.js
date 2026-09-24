const xml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
export async function onRequestGet(context) {
  const origin = new URL(context.request.url).origin;
  const [result, topics] = await Promise.all([
    context.env.DB.prepare("SELECT slug,updated_at FROM content_items WHERE status='published' AND published_at<=? ORDER BY published_at DESC").bind(new Date().toISOString()).all(),
    context.env.DB.prepare("SELECT slug,updated_at FROM forum_topics WHERE status<>'archived' ORDER BY updated_at DESC").all()
  ]);
  const fixed = ["/", "/recherche/", "/forums/", "/connexion/", "/inscription/", "/mentions-legales/", "/confidentialite/", "/cookies/"];
  const urls = fixed.map((path) => `<url><loc>${xml(origin + path)}</loc></url>`).concat((result.results || []).map((item) => `<url><loc>${xml(`${origin}/articles/${item.slug}`)}</loc><lastmod>${xml(item.updated_at.slice(0,10))}</lastmod></url>`),(topics.results || []).map((item) => `<url><loc>${xml(`${origin}/forums/${item.slug}`)}</loc><lastmod>${xml(item.updated_at.slice(0,10))}</lastmod></url>`));
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>`, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}

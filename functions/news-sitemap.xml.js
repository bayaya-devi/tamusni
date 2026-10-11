const xml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);

// Google News only accepts articles published during the last 48 hours.  One
// canonical French URL per story avoids presenting translations as duplicates.
export async function onRequestGet(context) {
  const origin = (context.env.PUBLIC_SITE_URL || new URL(context.request.url).origin).replace(/\/$/, "");
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const result = await context.env.DB.prepare(`SELECT slug,title,published_at FROM content_items WHERE status='published' AND published_at>=? AND published_at<=? AND COALESCE(sponsored,0)=0 ORDER BY published_at DESC LIMIT 1000`).bind(since, new Date().toISOString()).all();
  const entries = (result.results || []).filter((item) => item.slug && item.title && item.published_at).map((item) => {
    const url = `${origin}/fr/articles/${encodeURIComponent(item.slug)}/`;
    return `<url><loc>${xml(url)}</loc><news:news><news:publication><news:name>TAMUSNI</news:name><news:language>fr</news:language></news:publication><news:publication_date>${xml(item.published_at)}</news:publication_date><news:title>${xml(item.title)}</news:title></news:news></url>`;
  });
  const body = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">${entries.join("")}</urlset>`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900", "X-Content-Type-Options": "nosniff" } });
}

const xml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
export async function onRequestGet(context) {
  const origin = (context.env.PUBLIC_SITE_URL || new URL(context.request.url).origin).replace(/\/$/, "");
  const result = await context.env.DB.prepare("SELECT slug,updated_at FROM content_items WHERE status='published' AND published_at<=? ORDER BY published_at DESC").bind(new Date().toISOString()).all();
  const locales = ["fr", "ar", "en", "es", "pt"];
  const fixed = ["", "intelligence-artificielle/", "innovation/", "robotique/", "cybersecurite/", "espace/", "a-propos/", "contact/", "methodologie-editoriale/", "politique-ia/", "politique-corrections/", "mentions-legales/", "confidentialite/", "cookies/", "conditions-utilisation/"];
  const paths = fixed.map((path) => ({ path, lastmod: null })).concat((result.results || []).map((item) => ({ path: `articles/${encodeURIComponent(item.slug)}/`, lastmod: item.updated_at?.slice(0, 10) || null })));
  const urls = paths.flatMap(({ path, lastmod }) => locales.map((locale) => {
    const alternates = locales.map((other) => `<xhtml:link rel="alternate" hreflang="${other}" href="${xml(`${origin}/${other}/${path}`)}"/>`).join("");
    return `<url><loc>${xml(`${origin}/${locale}/${path}`)}</loc>${lastmod ? `<lastmod>${xml(lastmod)}</lastmod>` : ""}${alternates}<xhtml:link rel="alternate" hreflang="x-default" href="${xml(`${origin}/fr/${path}`)}"/></url>`;
  }));
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join("")}</urlset>`, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}

const xml = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]);
const locales = ["fr", "ar", "en", "es", "pt"];
const fixedPaths = ["", "intelligence-artificielle/", "innovation/", "robotique/", "cybersecurite/", "espace/", "a-propos/", "contact/", "methodologie-editoriale/", "politique-ia/", "politique-corrections/", "mentions-legales/", "confidentialite/", "cookies/", "conditions-utilisation/"];

function availableLocales(rows, id) {
  const available = new Set(["fr"]);
  for (const row of rows) if (row.content_id === id && locales.includes(row.locale)) available.add(row.locale);
  return locales.filter((locale) => available.has(locale));
}

export async function onRequestGet(context) {
  const origin = (context.env.PUBLIC_SITE_URL || new URL(context.request.url).origin).replace(/\/$/, "");
  const now = new Date().toISOString();
  const [itemsResult, translationsResult] = await Promise.all([
    context.env.DB.prepare("SELECT id,slug,updated_at FROM content_items WHERE status='published' AND published_at<=? ORDER BY published_at DESC").bind(now).all(),
    context.env.DB.prepare("SELECT content_id,locale FROM content_translations WHERE locale IN ('en','ar') AND length(body)>0 UNION ALL SELECT content_id,locale FROM content_translations_extra WHERE locale IN ('es','pt') AND length(body)>0").all()
  ]);
  const translations = translationsResult.results || [];
  const pages = fixedPaths.map((path) => ({ path, lastmod: null, locales })).concat((itemsResult.results || []).map((item) => ({
    path: `articles/${encodeURIComponent(item.slug)}/`,
    lastmod: item.updated_at?.slice(0, 10) || null,
    locales: availableLocales(translations, item.id)
  })));
  const urls = pages.flatMap(({ path, lastmod, locales: pageLocales }) => pageLocales.map((locale) => {
    const alternates = pageLocales.map((other) => `<xhtml:link rel="alternate" hreflang="${other}" href="${xml(`${origin}/${other}/${path}`)}"/>`).join("");
    return `<url><loc>${xml(`${origin}/${locale}/${path}`)}</loc>${lastmod ? `<lastmod>${xml(lastmod)}</lastmod>` : ""}${alternates}<xhtml:link rel="alternate" hreflang="x-default" href="${xml(`${origin}/fr/${path}`)}"/></url>`;
  }));
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">${urls.join("")}</urlset>`, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" } });
}

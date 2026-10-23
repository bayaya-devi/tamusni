export function onRequestGet(context) {
  const origin = (context.env.PUBLIC_SITE_URL || new URL(context.request.url).origin).replace(/\/$/, "");
  const body = `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /compte/\nDisallow: /*/mon-espace/\nDisallow: /*/connexion/\nDisallow: /*/inscription/\nDisallow: /api/\nSitemap: ${origin}/sitemap.xml\nSitemap: ${origin}/news-sitemap.xml\n`;
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" } });
}

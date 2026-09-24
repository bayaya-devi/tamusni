export async function onRequestGet(context) {
  const item = await context.env.DB.prepare("SELECT adsense_client FROM advertisements WHERE provider='adsense' AND adsense_client IS NOT NULL ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, updated_at DESC LIMIT 1").first();
  const publisher = String(item?.adsense_client || "").replace(/^ca-/, "");
  const body = /^pub-\d{16}$/.test(publisher) ? `google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n` : "# Google AdSense n’est pas encore configuré sur TAMUSNI.\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}

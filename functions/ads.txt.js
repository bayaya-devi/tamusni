export async function onRequestGet(context) {
  const item = await context.env.DB.prepare("SELECT adsense_client FROM advertisements WHERE provider='adsense' AND adsense_client IS NOT NULL ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, updated_at DESC LIMIT 1").first();
  // Keep site verification available before the first ad unit is created in the admin.
  // The publisher ID is public by design in ads.txt; secrets are never stored here.
  const publisher = String(item?.adsense_client || "ca-pub-6628181824999575").replace(/^ca-/, "");
  const body = /^pub-\d{16}$/.test(publisher) ? `google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n` : "# Google AdSense n’est pas encore configuré sur TAMUSNI.\n";
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}

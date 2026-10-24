import { adsensePublisher } from './_lib/ads-config.js';

export async function onRequestGet(context) {
  const publisher = adsensePublisher(context.env);
  const body = /^pub-\d{16}$/.test(publisher)
    ? `google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n`
    : '# Google AdSense is not configured for TAMUSNI yet.\n';
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}

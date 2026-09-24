export async function onRequest(context) {
  const url = new URL(context.request.url);
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))));
  if (url.pathname.includes("tamusni-homepage")) return Response.redirect(`${url.origin}/`, 301);
  let response = await context.next();
  if (response.status === 200 && (response.headers.get("content-type") || "").includes("text/html")) {
    const html = await response.text();
    const assets = '<link rel="stylesheet" href="/site-shell.css">';
    const scripts = `<script src="/site-shell.js" defer></script>${url.pathname !== "/" ? '<script src="/translate-page.js" defer></script>' : ""}<script src="/ads-client.js" defer></script><script src="/consent.js" defer></script>`;
    const verification = '<meta name="google-adsense-account" content="ca-pub-6628181824999575">';
    const withScripts = html.replace(/<head>/i, `<head>${assets}${verification}`).replace("</body>", `${scripts}</body>`).replace(/<script\b(?![^>]*\bnonce=)/g, `<script nonce="${nonce}"`);
    response = new Response(withScripts, { status: response.status, statusText: response.statusText, headers: response.headers });
  }
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  headers.set("Content-Security-Policy", `default-src 'self'; object-src 'none'; script-src 'nonce-${nonce}' 'unsafe-inline' 'unsafe-eval' 'strict-dynamic' https: http:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self' https:; connect-src 'self' https:; frame-src https:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'`);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

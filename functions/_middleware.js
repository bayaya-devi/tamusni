export async function onRequest(context) {
  const url = new URL(context.request.url);
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))));
  if (url.pathname.includes("tamusni-homepage")) return Response.redirect(`${url.origin}/`, 301);
  let response = await context.next();
  if (response.status === 200 && (response.headers.get("content-type") || "").includes("text/html")) {
    const html = await response.text();
    const fonts = html.includes("fonts.googleapis.com") ? "" : '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Lora:wght@400;500&amp;family=Open+Sans:wght@400;600;700&amp;family=Playfair+Display:wght@500;600;700&amp;display=swap" rel="stylesheet">';
    const assets = `${fonts}<link rel="stylesheet" href="/site-shell.css">`;
    const scripts = `<script src="/site-shell.js" defer></script>${url.pathname !== "/" ? '<script src="/translate-page.js" defer></script>' : ""}<script src="/ads-client.js" defer></script><script src="/consent.js" defer></script>`;
    const verification = '<meta name="google-adsense-account" content="ca-pub-6628181824999575">';
    const shellHeader = '<header class="global-shell-header"><div class="global-shell-inner"><a class="global-shell-brand" href="/">TAMUSNI</a></div></header>';
    const shellFooter = '<footer class="global-shell-footer"><div class="global-footer-inner"><div class="global-footer-follow">Suivre TAMUSNI</div><div class="global-footer-social"><a href="#" aria-label="TAMUSNI sur X">X</a><a href="#" aria-label="TAMUSNI sur YouTube">YouTube</a><a href="#" aria-label="TAMUSNI sur Instagram">Instagram</a><a href="#" aria-label="TAMUSNI sur TikTok">TikTok</a><a href="#" aria-label="TAMUSNI sur Facebook">Facebook</a></div><div class="global-footer-bottom"><span>© 2026 TAMUSNI · A&amp;B TECHNOLOGIES</span><span><a href="/mentions-legales/">Mentions légales</a><a href="/confidentialite/">Confidentialité</a><a href="/cookies/">Cookies</a></span></div></div></footer>';
    let withShell = html.replace(/<\/head>/i, `${assets}${verification}</head>`);
    if (!withShell.includes('class="global-shell-header"')) withShell = withShell.replace(/<body([^>]*)>/i, `<body$1>${shellHeader}`);
    if (!withShell.includes('class="global-shell-footer"')) withShell = withShell.replace(/<\/body>/i, `${shellFooter}</body>`);
    const withScripts = withShell.replace("</body>", `${scripts}</body>`).replace(/<script\b(?![^>]*\bnonce=)/g, `<script nonce="${nonce}"`);
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

export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname.includes("tamusni-homepage")) return Response.redirect(`${url.origin}/`, 301);
  let response = await context.next();
  if (url.pathname !== "/" && response.status === 200 && (response.headers.get("content-type") || "").includes("text/html")) {
    const html = await response.text();
    response = new Response(html.replace("</body>", '<script src="/translate-page.js" defer></script></body>'), response);
  }
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

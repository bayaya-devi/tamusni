export async function onRequest(context) {
  const url = new URL(context.request.url);
  if (url.pathname.includes("tamusni-homepage")) return Response.redirect(`${url.origin}/`, 301);
  let response = await context.next();
  if (response.status === 200 && (response.headers.get("content-type") || "").includes("text/html")) {
    const html = await response.text();
    const scripts = `${url.pathname !== "/" ? '<script src="/translate-page.js" defer></script>' : ""}<script src="/consent.js" defer></script>`;
    response = new Response(html.replace("</body>", `${scripts}</body>`), { status: response.status, statusText: response.statusText, headers: response.headers });
  }
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  headers.set("X-Frame-Options", "DENY");
  headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  headers.set("Content-Security-Policy", "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; media-src 'self' https:; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

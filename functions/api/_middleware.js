const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function apiError(message, status) {
  return Response.json({ error: message }, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

export async function onRequest(context) {
  const request = context.request;
  const method = request.method.toUpperCase();
  const origin = request.headers.get("Origin");
  const expectedOrigin = new URL(request.url).origin;

  if (method === "OPTIONS") return new Response(null, { status: 204, headers: { Allow: "GET, POST, PATCH, PUT, DELETE, OPTIONS" } });
  if (unsafeMethods.has(method) && origin && origin !== expectedOrigin) return apiError("Origine refusée.", 403);

  const response = await context.next();
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "same-origin");
  headers.set("Cross-Origin-Resource-Policy", "same-origin");
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

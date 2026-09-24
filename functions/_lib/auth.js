const encoder = new TextEncoder();

export function json(data, status = 200, headers = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store", ...headers } });
}

export async function readBody(request) {
  if ((request.headers.get("content-length") || "0") > 20_000) throw new Error("PAYLOAD_TOO_LARGE");
  return request.json();
}

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(normalized + "=".repeat((4 - normalized.length % 4) % 4)), (character) => character.charCodeAt(0));
}

export async function hashPassword(password, saltBytes = crypto.getRandomValues(new Uint8Array(16))) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const hash = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations: 100_000 }, key, 256);
  return `pbkdf2$100000$${toBase64Url(saltBytes)}$${toBase64Url(hash)}`;
}

export async function verifyPassword(password, stored) {
  const [scheme, iterations, salt, expected] = String(stored).split("$");
  if (scheme !== "pbkdf2" || !iterations || !salt || !expected) return false;
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const hash = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: fromBase64Url(salt), iterations: Number(iterations) }, key, 256);
  const actualBytes = new Uint8Array(hash); const expectedBytes = fromBase64Url(expected);
  if (actualBytes.length !== expectedBytes.length) return false;
  let difference = 0; for (let index = 0; index < actualBytes.length; index += 1) difference |= actualBytes[index] ^ expectedBytes[index];
  return difference === 0;
}

export async function createSessionCookie(user, secret) {
  const payload = toBase64Url(encoder.encode(JSON.stringify({ sub: user.id, name: user.name, email: user.email, role: user.role, exp: Date.now() + 7 * 86_400_000 })));
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = toBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(payload)));
  return `tamusni_session=${payload}.${signature}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`;
}

export async function getSession(request, secret) {
  if (!secret) return null;
  const cookie = request.headers.get("cookie") || "";
  const token = cookie.split(/;\s*/).find((item) => item.startsWith("tamusni_session="))?.slice(16);
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  try {
    const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("HMAC", key, fromBase64Url(signature), encoder.encode(payload));
    if (!valid) return null;
    const session = JSON.parse(new TextDecoder().decode(fromBase64Url(payload)));
    return session.exp > Date.now() && session.sub ? session : null;
  } catch { return null; }
}

export async function requireSession(context) {
  const session = await getSession(context.request, context.env.SESSION_SECRET);
  return session || null;
}

export function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim().toLowerCase()); }
export function sameOrigin(request) { const origin = request.headers.get("origin"); return !origin || origin === new URL(request.url).origin; }
export async function hashToken(value) { return toBase64Url(await crypto.subtle.digest("SHA-256", encoder.encode(value))); }

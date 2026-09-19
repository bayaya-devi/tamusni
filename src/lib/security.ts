import { NextResponse } from "next/server";

type RateEntry = { count: number; reset: number };
const state = globalThis as typeof globalThis & { tamusniRateLimits?: Map<string, RateEntry> };
const limits = state.tamusniRateLimits ?? new Map<string, RateEntry>();
state.tamusniRateLimits = limits;

export function enforceSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try { if (new URL(origin).host === request.headers.get("host")) return null; } catch { /* handled below */ }
  return NextResponse.json({ error: "Requête non autorisée." }, { status: 403 });
}
export function enforceRateLimit(request: Request, scope: string, limit: number, windowMs: number) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${scope}:${ip}`; const now = Date.now(); const entry = limits.get(key);
  if (!entry || entry.reset < now) { limits.set(key, { count: 1, reset: now + windowMs }); return null; }
  entry.count += 1;
  if (entry.count <= limit) return null;
  return NextResponse.json({ error: "Trop de tentatives. Réessayez dans quelques instants." }, { status: 429, headers: { "Retry-After": String(Math.ceil((entry.reset - now) / 1000)) } });
}
export async function readJson<T>(request: Request, maxBytes = 8_192): Promise<T> {
  const length = Number(request.headers.get("content-length") || 0);
  if (length > maxBytes) throw new Error("PAYLOAD_TOO_LARGE");
  return request.json() as Promise<T>;
}

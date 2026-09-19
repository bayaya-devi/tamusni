import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

function signingSecret() { const value = process.env.AUTH_SECRET; if (!value && process.env.NODE_ENV === "production") throw new Error("AUTH_SECRET must be configured in production."); return new TextEncoder().encode(value || "tamusni-development-secret-local-only"); }
export type Session = { id: string; name: string; email: string; role: "USER" | "ADMIN" };
export async function createSession(session: Session) { return new SignJWT(session).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("8h").sign(signingSecret()); }
export async function getSession(): Promise<Session | null> { const token = (await cookies()).get("tamusni_session")?.value; if (!token) return null; try { return (await jwtVerify(token, signingSecret())).payload as unknown as Session; } catch { return null; } }
export async function setSession(session: Session) { const token = await createSession(session); (await cookies()).set("tamusni_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 8 }); }
export async function clearSession() { (await cookies()).delete("tamusni_session"); }

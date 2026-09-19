import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "tamusni-development-secret-change-before-production");
export type Session = { id: string; name: string; email: string; role: "USER" | "ADMIN" };
export async function createSession(session: Session) { return new SignJWT(session).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("7d").sign(secret); }
export async function getSession(): Promise<Session | null> { const token = (await cookies()).get("tamusni_session")?.value; if (!token) return null; try { return (await jwtVerify(token, secret)).payload as unknown as Session; } catch { return null; } }
export async function setSession(session: Session) { const token = await createSession(session); (await cookies()).set("tamusni_session", token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 }); }
export async function clearSession() { (await cookies()).delete("tamusni_session"); }

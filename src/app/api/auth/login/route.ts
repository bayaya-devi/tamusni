import { NextResponse } from "next/server";
import { z } from "zod";
import { userRepository, verifyPassword } from "@/lib/db";
import { setSession } from "@/lib/auth";
import { enforceRateLimit, enforceSameOrigin, readJson } from "@/lib/security";
const schema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(128) });
export async function POST(request: Request) { const origin = enforceSameOrigin(request); if (origin) return origin; const rate = enforceRateLimit(request, "login", 8, 900_000); if (rate) return rate; try { const input = schema.parse(await readJson(request)); const user = await userRepository.findByEmail(input.email); if (!user || !(await verifyPassword(input.password, user.password_hash))) return NextResponse.json({ error: "Adresse e-mail ou mot de passe incorrect." }, { status: 401 }); await setSession({ id: user.id, name: user.name, email: user.email, role: user.role }); return NextResponse.json({ redirect: user.role === "ADMIN" ? "/admin" : "/compte" }); } catch (error) { if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") return NextResponse.json({ error: "Requête trop volumineuse." }, { status: 413 }); return NextResponse.json({ error: "Informations de connexion invalides." }, { status: 400 }); } }

import { NextResponse } from "next/server";
import { z } from "zod";
import { userRepository, verifyPassword } from "@/lib/db";
import { setSession } from "@/lib/auth";
const schema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });
export async function POST(request: Request) { try { const input = schema.parse(await request.json()); const user = userRepository.findByEmail(input.email); if (!user || !(await verifyPassword(input.password, user.password_hash))) return NextResponse.json({ error: "Adresse e-mail ou mot de passe incorrect." }, { status: 401 }); await setSession({ id: user.id, name: user.name, email: user.email, role: user.role }); return NextResponse.json({ redirect: user.role === "ADMIN" ? "/admin" : "/compte" }); } catch { return NextResponse.json({ error: "Informations de connexion invalides." }, { status: 400 }); } }

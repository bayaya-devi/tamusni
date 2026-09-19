import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, resetRepository, userRepository } from "@/lib/db";
import { enforceRateLimit, enforceSameOrigin, readJson } from "@/lib/security";
const schema = z.object({ token: z.string().min(20).max(200), password: z.string().min(6).max(128) });
export async function POST(request: Request) { const origin = enforceSameOrigin(request); if (origin) return origin; const rate = enforceRateLimit(request, "reset-password", 5, 900_000); if (rate) return rate; try { const { token, password } = schema.parse(await readJson(request)); const userId = resetRepository.consume(token); if (!userId || !userRepository.findById(userId)) return NextResponse.json({ error: "Ce lien est invalide ou a expiré." }, { status: 400 }); userRepository.updatePassword(userId, await hashPassword(password)); return NextResponse.json({ redirect: "/connexion" }); } catch { return NextResponse.json({ error: "Ce lien est invalide ou a expiré." }, { status: 400 }); } }

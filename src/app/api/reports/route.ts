import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { adminRepository } from "@/lib/db";
import { enforceRateLimit, enforceSameOrigin, readJson } from "@/lib/security";
const schema = z.object({ subjectType: z.string().trim().min(2).max(40), subjectId: z.string().trim().min(1).max(160), reason: z.string().trim().min(10).max(1000) });
export async function POST(request: Request) { const origin = enforceSameOrigin(request); if (origin) return origin; const rate = enforceRateLimit(request, "report", 10, 900_000); if (rate) return rate; const session = await getSession(); if (!session) return NextResponse.json({ error: "Connexion requise." }, { status: 401 }); try { const input = schema.parse(await readJson(request)); await adminRepository.createReport(session, input.subjectType, input.subjectId, input.reason); return NextResponse.json({ ok: true }, { status: 201 }); } catch { return NextResponse.json({ error: "Signalement invalide." }, { status: 400 }); } }

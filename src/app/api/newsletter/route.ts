import { NextResponse } from "next/server";
import { z } from "zod";
import { newsletterRepository } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { enforceRateLimit, enforceSameOrigin, readJson } from "@/lib/security";
const schema = z.object({ email: z.string().trim().email().max(120) });
export async function POST(request: Request) { const origin = enforceSameOrigin(request); if (origin) return origin; const rate = enforceRateLimit(request, "newsletter", 4, 900_000); if (rate) return rate; try { const { email } = schema.parse(await readJson(request)); newsletterRepository.create(email); await sendEmail({ to: email, subject: "Votre inscription à TAMUSNI", html: "<p>Votre inscription à la newsletter TAMUSNI est enregistrée.</p>" }); return NextResponse.json({ ok: true }); } catch (error) { if (error instanceof Error && error.message === "PAYLOAD_TOO_LARGE") return NextResponse.json({ error: "Requête trop volumineuse." }, { status: 413 }); return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 }); } }

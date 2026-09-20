import { NextResponse } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { resetRepository, userRepository } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { enforceRateLimit, enforceSameOrigin, readJson } from "@/lib/security";
const schema = z.object({ email: z.string().trim().email().max(120) });
export async function POST(request: Request) { const origin = enforceSameOrigin(request); if (origin) return origin; const rate = enforceRateLimit(request, "forgot-password", 3, 900_000); if (rate) return rate; try { const { email } = schema.parse(await readJson(request)); const user = await userRepository.findByEmail(email); if (user) { const token = randomBytes(32).toString("base64url"); await resetRepository.create(user.id, token); const base = process.env.APP_URL || new URL(request.url).origin; await sendEmail({ to: user.email, subject: "Réinitialisez votre mot de passe TAMUSNI", html: `<p>Une demande de réinitialisation a été reçue.</p><p><a href="${base}/reinitialiser-mot-de-passe?token=${token}">Choisir un nouveau mot de passe</a></p><p>Ce lien expire dans 30 minutes.</p>` }); } return NextResponse.json({ ok: true }); } catch { return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 }); } }

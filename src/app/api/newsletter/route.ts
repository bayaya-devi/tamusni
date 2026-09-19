import { NextResponse } from "next/server";
import { z } from "zod";
import { newsletterRepository } from "@/lib/db";
import { sendEmail } from "@/lib/email";
const schema = z.object({ email: z.string().trim().email().max(120) });
export async function POST(request: Request) { try { const { email } = schema.parse(await request.json()); newsletterRepository.create(email); await sendEmail({ to: email, subject: "Votre inscription à TAMUSNI", html: "<p>Votre inscription à la newsletter TAMUSNI est enregistrée. Vous recevrez bientôt notre prochaine édition.</p>" }); return NextResponse.json({ ok: true }); } catch { return NextResponse.json({ error: "Adresse e-mail invalide." }, { status: 400 }); } }

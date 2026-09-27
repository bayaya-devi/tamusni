import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRepository } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
import { enforceSameOrigin, readJson } from "@/lib/security";
const schema = z.object({ id: z.string().min(4).max(100), status: z.enum(["ACTIVE", "BANNED"]) });
export async function GET() { const { response } = await requireAdmin(); if (response) return response; return NextResponse.json({ items: await adminRepository.listUsers() }); }
export async function PATCH(request: Request) { const origin = enforceSameOrigin(request); if (origin) return origin; const { session, response } = await requireAdmin(); if (response || !session) return response!; try { const input = schema.parse(await readJson(request)); if (input.id === session.id) return NextResponse.json({ error: "Vous ne pouvez pas suspendre votre propre compte." }, { status: 400 }); await adminRepository.setUserStatus(input.id, input.status); return NextResponse.json({ ok: true }); } catch { return NextResponse.json({ error: "Modification invalide." }, { status: 400 }); } }

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return { session: null, response: NextResponse.json({ error: "Accès réservé à l’administration." }, { status: 403 }) };
  return { session, response: null };
}

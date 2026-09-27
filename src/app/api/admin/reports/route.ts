import { NextResponse } from "next/server";
import { adminRepository } from "@/lib/db";
import { requireAdmin } from "@/lib/admin";
export async function GET() { const { response } = await requireAdmin(); if (response) return response; return NextResponse.json({ items: await adminRepository.listReports() }); }

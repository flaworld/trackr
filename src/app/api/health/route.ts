import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// Lightweight liveness/readiness probe for uptime monitors and post-deploy
// checks. Public (no secret) and leaks nothing sensitive. Returns 200 when the
// app + database are reachable, 503 otherwise.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startedAt = Date.now();

export async function GET() {
  let db = false;
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    db = true;
  } catch {
    db = false;
  }

  const body = {
    status: db ? "ok" : "degraded",
    db,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  };
  return NextResponse.json(body, { status: db ? 200 : 503 });
}

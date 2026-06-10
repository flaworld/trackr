import { NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET /api/users — for owner dropdowns.
export const GET = handle(async () => {
  await requireUser();
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });
  return NextResponse.json({ users });
});

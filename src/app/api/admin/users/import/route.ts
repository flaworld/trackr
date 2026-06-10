import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { importUsersCsv } from "@/lib/users";

const schema = z.object({ csv: z.string().min(1).max(1_000_000) });

// POST /api/admin/users/import — bulk create/update users from CSV text.
// Header row required; columns: email (required), name, role, manager (email).
export const POST = handle(async (req: NextRequest) => {
  await requirePermission("users:manage");
  const { csv } = schema.parse(await req.json());
  const result = await importUsersCsv(csv);
  return NextResponse.json(result);
});

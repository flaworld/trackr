import { NextRequest, NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { getMailboxConfig } from "@/lib/mailboxes";
import { testMailboxConnection } from "@/lib/imap";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/admin/mailboxes/:id/test — read-only IMAP connection check.
export const POST = handle(async (_req: NextRequest, ctx: Ctx) => {
  await requirePermission("users:manage");
  const { id } = await ctx.params;
  const mb = await getMailboxConfig(id);
  if (!mb) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const result = await testMailboxConnection(mb);
  return NextResponse.json(result);
});

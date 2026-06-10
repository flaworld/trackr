import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { updateMailbox, deleteMailbox } from "@/lib/mailboxes";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  address: z.string().max(200).optional().nullable(),
  inbound: z.boolean().optional(),
  active: z.boolean().optional(),
  imapHost: z.string().max(200).optional().nullable(),
  imapPort: z.number().int().min(1).max(65535).optional().nullable(),
  imapSecure: z.boolean().optional(),
  imapUser: z.string().max(200).optional().nullable(),
  allowSelfSigned: z.boolean().optional(),
  processedFolder: z.string().max(200).optional().nullable(),
  failedFolder: z.string().max(200).optional().nullable(),
  moveProcessed: z.boolean().optional(),
});

// PATCH /api/admin/mailboxes/:id — update mailbox config (key is immutable).
export const PATCH = handle(async (req: NextRequest, ctx: Ctx) => {
  await requirePermission("users:manage");
  const { id } = await ctx.params;
  const body = patchSchema.parse(await req.json());
  await updateMailbox(id, body);
  return NextResponse.json({ ok: true });
});

// DELETE /api/admin/mailboxes/:id — only when no tasks/emails reference it.
export const DELETE = handle(async (_req: NextRequest, ctx: Ctx) => {
  await requirePermission("users:manage");
  const { id } = await ctx.params;
  const result = await deleteMailbox(id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 409 });
  }
  return NextResponse.json({ ok: true });
});

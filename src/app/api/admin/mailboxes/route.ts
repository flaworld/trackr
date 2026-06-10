import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { listMailboxesAdmin, createMailbox } from "@/lib/mailboxes";

// GET /api/admin/mailboxes — full mailbox list (config + password-set status).
export const GET = handle(async () => {
  await requirePermission("users:manage");
  const mailboxes = await listMailboxesAdmin();
  return NextResponse.json({ mailboxes });
});

const createSchema = z.object({
  key: z.string().min(1).max(40),
  displayName: z.string().min(1).max(100),
  address: z.string().max(200).optional().nullable(),
  inbound: z.boolean(),
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

// POST /api/admin/mailboxes — create a mailbox/source stream.
export const POST = handle(async (req: NextRequest) => {
  await requirePermission("users:manage");
  const body = createSchema.parse(await req.json());
  try {
    const mb = await createMailbox(body);
    return NextResponse.json({ mailbox: mb }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    if (/unique|P2002/i.test(msg)) {
      return NextResponse.json(
        { error: "A mailbox with that key already exists." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
});

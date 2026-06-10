import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { requirePermission } from "@/lib/auth";
import { listUsersAdmin, createUser, setMailboxGrants } from "@/lib/users";
import { ROLES } from "@/lib/constants";

// GET /api/admin/users — full user list for the admin console.
export const GET = handle(async () => {
  await requirePermission("users:manage");
  const users = await listUsersAdmin();
  return NextResponse.json({ users });
});

const grantSchema = z.object({
  mailboxId: z.string(),
  canViewAll: z.boolean(),
  canReview: z.boolean(),
});

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().max(200).optional(),
  role: z.enum(ROLES).optional(),
  managerId: z.string().optional().nullable(),
  password: z.string().min(8).max(200).optional().nullable(),
  grants: z.array(grantSchema).optional(),
});

// POST /api/admin/users — create a user (SSO-only unless a password is set).
export const POST = handle(async (req: NextRequest) => {
  await requirePermission("users:manage");
  const body = createSchema.parse(await req.json());
  try {
    const user = await createUser({
      email: body.email,
      name: body.name,
      role: body.role,
      managerId: body.managerId ?? null,
      password: body.password ?? null,
    });
    if (body.grants?.length) await setMailboxGrants(user.id, body.grants);
    return NextResponse.json({ user }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Create failed";
    // Unique email violation surfaces here.
    if (/unique|already exists|P2002/i.test(msg)) {
      return NextResponse.json(
        { error: "A user with that email already exists." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
});

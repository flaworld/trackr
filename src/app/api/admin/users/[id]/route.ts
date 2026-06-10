import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { requirePermission, AuthError } from "@/lib/auth";
import { updateUser, setMailboxGrants } from "@/lib/users";
import { ROLES } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.enum(ROLES).optional(),
  managerId: z.string().optional().nullable(),
  active: z.boolean().optional(),
  password: z.string().max(200).optional().nullable(), // "" clears, 8+ sets
  grants: z
    .array(
      z.object({
        mailboxId: z.string(),
        canViewAll: z.boolean(),
        canReview: z.boolean(),
      }),
    )
    .optional(),
});

// PATCH /api/admin/users/:id — update a user (role/manager/active/password/grants).
export const PATCH = handle(async (req: NextRequest, ctx: Ctx) => {
  const admin = await requirePermission("users:manage");
  const { id } = await ctx.params;
  const body = patchSchema.parse(await req.json());

  // Self-lockout guards: an admin can't demote or deactivate their own account.
  if (id === admin.id) {
    if (body.active === false) {
      throw new AuthError("You can't deactivate your own account.", 400);
    }
    if (body.role && body.role !== "admin") {
      throw new AuthError("You can't change your own admin role.", 400);
    }
  }

  if (body.password && body.password.length > 0 && body.password.length < 8) {
    throw new AuthError("Password must be at least 8 characters.", 400);
  }

  await updateUser(id, {
    name: body.name,
    role: body.role,
    managerId: body.managerId,
    active: body.active,
    password: body.password,
  });
  if (body.grants) await setMailboxGrants(id, body.grants);

  return NextResponse.json({ ok: true });
});

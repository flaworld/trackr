import { NextRequest, NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireUser, AuthError } from "@/lib/auth";
import { rejectSuggestion, authorizeSuggestion } from "@/lib/review";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/email-updates/:id/reject (spec §5)
export const POST = handle(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!(await authorizeSuggestion(user, id))) {
    throw new AuthError("You can't review this suggestion.", 403);
  }
  await rejectSuggestion(id, user.id);
  return NextResponse.json({ ok: true });
});

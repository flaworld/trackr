import { NextRequest, NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireUser, AuthError } from "@/lib/auth";
import { authorizeSuggestion } from "@/lib/review";
import { approveSuggestion } from "@/lib/review";

type Ctx = { params: Promise<{ id: string }> };

// POST /api/email-updates/:id/approve (spec §5/§14)
// :id is the suggestion id. Applies the suggested update to the task.
export const POST = handle(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!(await authorizeSuggestion(user, id))) {
    throw new AuthError("You can't review this suggestion.", 403);
  }
  const result = await approveSuggestion(id, user.id);
  return NextResponse.json({ ok: true, ...result });
});

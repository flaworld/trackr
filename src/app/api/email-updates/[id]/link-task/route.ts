import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { requireUser, AuthError } from "@/lib/auth";
import {
  createTaskFromSuggestion,
  linkSuggestionToTask,
  authorizeSuggestion,
} from "@/lib/review";

type Ctx = { params: Promise<{ id: string }> };

const schema = z.object({
  taskId: z.string().optional(),
  createNew: z.boolean().optional(),
  taskName: z.string().max(300).optional(),
});

// POST /api/email-updates/:id/link-task (spec §5)
// Body: { taskId } to relink, or { createNew: true, taskName? } to spin up a
// new task from the email (spec §9 "Create new task from email").
export const POST = handle(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!(await authorizeSuggestion(user, id))) {
    throw new AuthError("You can't review this suggestion.", 403);
  }
  const body = schema.parse(await req.json());

  if (body.createNew) {
    const task = await createTaskFromSuggestion(id, user.id, body.taskName);
    return NextResponse.json({ ok: true, task });
  }
  if (!body.taskId) {
    return NextResponse.json(
      { error: "taskId or createNew is required" },
      { status: 400 },
    );
  }
  const result = await linkSuggestionToTask(id, body.taskId);
  return NextResponse.json({ ok: true, ...result });
});

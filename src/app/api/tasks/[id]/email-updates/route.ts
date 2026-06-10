import { NextRequest, NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireUser, AuthError } from "@/lib/auth";
import { canViewTask } from "@/lib/access";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/tasks/:id/email-updates (spec §5) — emails linked to this task,
// either as a confirmed match or via a suggestion.
export const GET = handle(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const task = await prisma.task.findUnique({
    where: { id },
    select: { ownerId: true, mailboxId: true },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canViewTask(user, task))) {
    throw new AuthError("You don't have access to this task.", 403);
  }
  const emails = await prisma.emailUpdate.findMany({
    where: {
      OR: [{ matchedTaskId: id }, { suggestions: { some: { taskId: id } } }],
    },
    orderBy: { receivedAt: "desc" },
    include: {
      attachments: true,
      suggestions: {
        where: { taskId: id },
        select: {
          id: true,
          reviewStatus: true,
          confidenceScore: true,
          suggestedStatus: true,
          suggestedDueDate: true,
        },
      },
    },
  });
  return NextResponse.json({ emailUpdates: emails });
});

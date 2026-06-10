import { NextRequest, NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireUser, AuthError } from "@/lib/auth";
import { canViewTask } from "@/lib/access";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ id: string }> };

// GET /api/tasks/:id/history (spec §5)
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
  const history = await prisma.taskHistory.findMany({
    where: { taskId: id },
    orderBy: { createdAt: "desc" },
    include: {
      changedBy: { select: { id: true, name: true, email: true } },
      sourceEmail: { select: { id: true, subject: true, fromEmail: true } },
    },
  });
  return NextResponse.json({ history });
});

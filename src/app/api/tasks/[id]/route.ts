import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handle } from "@/lib/api";
import { requireUser, AuthError } from "@/lib/auth";
import { updateTaskManual } from "@/lib/tasks";
import { canViewTask, canEditTask } from "@/lib/access";
import { prisma } from "@/lib/db";
import { TASK_STATUSES, PRIORITIES } from "@/lib/constants";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  taskName: z.string().min(1).max(300).optional(),
  ownerId: z.string().optional().nullable(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueDate: z.string().datetime().or(z.string().length(0)).optional().nullable(),
  latestNotes: z.string().max(5000).optional().nullable(),
});

// GET /api/tasks/:id
export const GET = handle(async (_req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const task = await prisma.task.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      mailbox: { select: { id: true, key: true, displayName: true } },
    },
  });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(await canViewTask(user, task))) {
    throw new AuthError("You don't have access to this task.", 403);
  }
  return NextResponse.json({ task });
});

// PATCH /api/tasks/:id — manual update (spec §5)
export const PATCH = handle(async (req: NextRequest, ctx: Ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = patchSchema.parse(await req.json());

  // Permission: editAny, own task, a report's task (managers), or notes-only
  // on an owned task (members). See src/lib/access.ts.
  const editingOnlyNotes =
    Object.keys(body).length === 1 && body.latestNotes !== undefined;
  const allowed = await canEditTask(user, task, {
    notesOnly: editingOnlyNotes,
  });
  if (!allowed) {
    throw new AuthError("You can't edit this task.", 403);
  }

  const updated = await updateTaskManual(id, user.id, {
    taskName: body.taskName,
    ownerId: body.ownerId === undefined ? undefined : body.ownerId || null,
    status: body.status,
    priority: body.priority,
    dueDate:
      body.dueDate === undefined
        ? undefined
        : body.dueDate
          ? new Date(body.dueDate)
          : null,
    latestNotes: body.latestNotes ?? undefined,
  });
  return NextResponse.json({ task: updated });
});

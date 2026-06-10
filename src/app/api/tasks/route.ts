import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { handle } from "@/lib/api";
import { requirePermission, AuthError } from "@/lib/auth";
import { createTask, listTasks, mailboxIdByKey } from "@/lib/tasks";
import {
  visibleTaskWhere,
  reportIds,
  mailboxViewAllIds,
} from "@/lib/access";
import { TASK_STATUSES, PRIORITIES } from "@/lib/constants";

// Build the extra scope for the requested "view" (within the user's visible
// set). Returns null if the user isn't allowed that view.
async function viewScope(
  view: string | null,
  user: { id: string; role: string },
): Promise<Prisma.TaskWhereInput | null> {
  if (!view || view === "my") {
    return view === "my" ? { ownerId: user.id } : {};
  }
  if (view === "team") {
    const reports = await reportIds(user.id);
    return { ownerId: { in: [user.id, ...reports] } };
  }
  if (view === "all") {
    return user.role === "admin" ? {} : null;
  }
  if (view.startsWith("mailbox:")) {
    const key = view.slice("mailbox:".length);
    const mbId = await mailboxIdByKey(key);
    if (!mbId) return null;
    if (user.role === "admin") return { mailboxId: mbId };
    const granted = await mailboxViewAllIds(user.id);
    return granted.includes(mbId) ? { mailboxId: mbId } : null;
  }
  return {};
}

// GET /api/tasks — list with filters (spec §5), scoped to what the user may see
export const GET = handle(async (req: NextRequest) => {
  const user = await requirePermission("view");
  const sp = req.nextUrl.searchParams;

  const scope = await viewScope(sp.get("view"), user);
  if (scope === null) {
    throw new AuthError("You don't have access to that view.", 403);
  }

  const tasks = await listTasks(
    {
      status: sp.get("status") ?? undefined,
      ownerId: sp.get("ownerId") ?? undefined,
      mailboxId: sp.get("mailboxId") ?? undefined,
      priority: sp.get("priority") ?? undefined,
      overdue: sp.get("overdue") === "true",
      search: sp.get("search") ?? undefined,
      dueBefore: sp.get("dueBefore") ? new Date(sp.get("dueBefore")!) : undefined,
      dueAfter: sp.get("dueAfter") ? new Date(sp.get("dueAfter")!) : undefined,
    },
    // Visibility is always enforced; the view further narrows within it.
    [await visibleTaskWhere(user), scope],
  );
  return NextResponse.json({ tasks });
});

const createSchema = z.object({
  taskName: z.string().min(1, "Task name is required").max(300),
  ownerId: z.string().optional().nullable(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  dueDate: z.string().datetime().or(z.string().length(0)).optional().nullable(),
  latestNotes: z.string().max(5000).optional().nullable(),
  mailboxId: z.string().optional().nullable(),
});

// POST /api/tasks — create (spec §5). Manual tasks default to the "General"
// mailbox unless a mailbox is explicitly provided.
export const POST = handle(async (req: NextRequest) => {
  const user = await requirePermission("task:create");
  const body = createSchema.parse(await req.json());
  const mailboxId = body.mailboxId || (await mailboxIdByKey("general"));
  const task = await createTask({
    taskName: body.taskName,
    ownerId: body.ownerId || null,
    status: body.status,
    priority: body.priority,
    dueDate: body.dueDate ? new Date(body.dueDate) : null,
    latestNotes: body.latestNotes ?? null,
    mailboxId,
    createdById: user.id,
  });
  return NextResponse.json({ task }, { status: 201 });
});

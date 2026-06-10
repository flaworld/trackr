import "server-only";
import { prisma } from "./db";
import { TASK_STATUSES, PRIORITIES } from "./constants";
import type { Prisma } from "@prisma/client";

// Generate the next TASK-### code (max existing numeric suffix + 1).
export async function nextTaskCode(): Promise<string> {
  const tasks = await prisma.task.findMany({ select: { taskCode: true } });
  let max = 100;
  for (const t of tasks) {
    const m = t.taskCode.match(/TASK-(\d+)/i);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `TASK-${max + 1}`;
}

// A task is "Overdue" (display) when it has a past due date and is not Completed.
export function isOverdue(t: {
  dueDate: Date | null;
  status: string;
}): boolean {
  if (!t.dueDate || t.status === "Completed") return false;
  return t.dueDate.getTime() < Date.now();
}

export function displayStatus(t: { dueDate: Date | null; status: string }): string {
  if (t.status !== "Completed" && t.status !== "Overdue" && isOverdue(t)) {
    return "Overdue";
  }
  return t.status;
}

export type TaskFilters = {
  status?: string;
  ownerId?: string;
  mailboxId?: string;
  priority?: string;
  overdue?: boolean;
  dueBefore?: Date;
  dueAfter?: Date;
  search?: string;
};

// Resolve a mailbox id by its key (e.g. "general", "cmo"). Cached-ish lookups
// are cheap at this scale.
export async function mailboxIdByKey(key: string): Promise<string | null> {
  const mb = await prisma.mailbox.findUnique({
    where: { key },
    select: { id: true },
  });
  return mb?.id ?? null;
}

// `scopes` are additional where-clauses ANDed in — used for row-level
// visibility (visibleTaskWhere) and the view switcher (team/mailbox/all).
export async function listTasks(
  filters: TaskFilters = {},
  scopes: Prisma.TaskWhereInput[] = [],
) {
  const filterWhere: Prisma.TaskWhereInput = {};

  if (filters.status && TASK_STATUSES.includes(filters.status as never)) {
    if (filters.status === "Overdue") {
      filterWhere.status = { notIn: ["Completed"] };
      filterWhere.dueDate = { lt: new Date() };
    } else {
      filterWhere.status = filters.status;
    }
  }
  if (filters.ownerId) filterWhere.ownerId = filters.ownerId;
  if (filters.mailboxId) filterWhere.mailboxId = filters.mailboxId;
  if (filters.priority && PRIORITIES.includes(filters.priority as never)) {
    filterWhere.priority = filters.priority;
  }
  if (filters.overdue) {
    filterWhere.status = { notIn: ["Completed"] };
    filterWhere.dueDate = { lt: new Date() };
  }
  if (filters.dueBefore || filters.dueAfter) {
    filterWhere.dueDate = {
      ...(filters.dueBefore ? { lte: filters.dueBefore } : {}),
      ...(filters.dueAfter ? { gte: filters.dueAfter } : {}),
    };
  }
  if (filters.search) {
    const q = filters.search;
    filterWhere.OR = [
      { taskName: { contains: q, mode: "insensitive" } },
      { taskCode: { contains: q, mode: "insensitive" } },
      { latestNotes: { contains: q, mode: "insensitive" } },
    ];
  }

  const where: Prisma.TaskWhereInput = {
    AND: [{ archivedAt: null }, filterWhere, ...scopes],
  };

  const tasks = await prisma.task.findMany({
    where,
    orderBy: [{ lastUpdated: "desc" }],
    include: {
      owner: { select: { id: true, name: true, email: true } },
      mailbox: { select: { id: true, key: true, displayName: true } },
      _count: { select: { suggestions: true, matchedEmails: true } },
    },
  });

  return tasks.map((t) => ({
    ...t,
    displayStatus: displayStatus(t),
    isOverdue: isOverdue(t),
  }));
}

// --- Manual create (writes a history row) ---
export async function createTask(input: {
  taskName: string;
  ownerId?: string | null;
  status?: string;
  priority?: string;
  dueDate?: Date | null;
  latestNotes?: string | null;
  assignedDate?: Date | null;
  mailboxId?: string | null;
  createdById: string;
}) {
  const code = await nextTaskCode();
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        taskCode: code,
        taskName: input.taskName,
        ownerId: input.ownerId ?? null,
        status: input.status ?? "Not Started",
        priority: input.priority ?? "Medium",
        dueDate: input.dueDate ?? null,
        latestNotes: input.latestNotes ?? null,
        assignedDate: input.assignedDate ?? new Date(),
        mailboxId: input.mailboxId ?? null,
        createdById: input.createdById,
        lastUpdated: new Date(),
      },
    });
    await tx.taskHistory.create({
      data: {
        taskId: task.id,
        changedById: input.createdById,
        sourceType: "manual",
        newStatus: task.status,
        newDueDate: task.dueDate,
        notes: "Task created.",
      },
    });
    return task;
  });
}

// --- Manual update (diffs fields, writes a history row) ---
export async function updateTaskManual(
  taskId: string,
  changedById: string,
  patch: {
    taskName?: string;
    ownerId?: string | null;
    status?: string;
    priority?: string;
    dueDate?: Date | null;
    latestNotes?: string | null;
  },
) {
  return prisma.$transaction(async (tx) => {
    const before = await tx.task.findUnique({ where: { id: taskId } });
    if (!before) throw new Error("Task not found");

    const data: Prisma.TaskUpdateInput = { lastUpdated: new Date() };
    if (patch.taskName !== undefined) data.taskName = patch.taskName;
    if (patch.ownerId !== undefined) {
      data.owner = patch.ownerId
        ? { connect: { id: patch.ownerId } }
        : { disconnect: true };
    }
    if (patch.status !== undefined) data.status = patch.status;
    if (patch.priority !== undefined) data.priority = patch.priority;
    if (patch.dueDate !== undefined) data.dueDate = patch.dueDate;
    if (patch.latestNotes !== undefined) data.latestNotes = patch.latestNotes;

    const after = await tx.task.update({ where: { id: taskId }, data });

    const statusChanged =
      patch.status !== undefined && patch.status !== before.status;
    const dueChanged =
      patch.dueDate !== undefined &&
      (before.dueDate?.getTime() ?? null) !== (patch.dueDate?.getTime() ?? null);

    // Record history when something material changed.
    const materialChange =
      statusChanged ||
      dueChanged ||
      patch.latestNotes !== undefined ||
      patch.taskName !== undefined ||
      patch.ownerId !== undefined ||
      patch.priority !== undefined;

    if (materialChange) {
      await tx.taskHistory.create({
        data: {
          taskId,
          changedById,
          sourceType: "manual",
          previousStatus: statusChanged ? before.status : null,
          newStatus: statusChanged ? after.status : null,
          previousDueDate: dueChanged ? before.dueDate : null,
          newDueDate: dueChanged ? after.dueDate : null,
          notes:
            patch.latestNotes !== undefined
              ? patch.latestNotes
              : "Task details updated.",
        },
      });
    }
    return after;
  });
}

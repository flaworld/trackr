import "server-only";
import { prisma } from "./db";
import { can } from "./constants";
import type { Prisma } from "@prisma/client";
import type { SessionUser } from "./auth";

// Row-level access control (V2 expansion). Single source of truth for "which
// tasks can this user see / act on", driven by assignment + reporting hierarchy
// + mailbox grants. See docs/EXPANSION_PLAN.md.

// Transitive set of users reporting to `userId` (direct + indirect). At ~40
// users an app-side breadth-first walk is plenty; swap for a recursive CTE if
// the org grows large.
export async function reportIds(userId: string): Promise<string[]> {
  const all = await prisma.user.findMany({
    select: { id: true, managerId: true },
  });
  const childrenByManager = new Map<string, string[]>();
  for (const x of all) {
    if (!x.managerId) continue;
    const arr = childrenByManager.get(x.managerId) ?? [];
    arr.push(x.id);
    childrenByManager.set(x.managerId, arr);
  }
  const out: string[] = [];
  const queue = [...(childrenByManager.get(userId) ?? [])];
  const seen = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
    for (const c of childrenByManager.get(id) ?? []) queue.push(c);
  }
  return out;
}

export async function mailboxViewAllIds(userId: string): Promise<string[]> {
  const rows = await prisma.mailboxAccess.findMany({
    where: { userId, canViewAll: true },
    select: { mailboxId: true },
  });
  return rows.map((r) => r.mailboxId);
}

export async function mailboxReviewIds(userId: string): Promise<string[]> {
  const rows = await prisma.mailboxAccess.findMany({
    where: { userId, canReview: true },
    select: { mailboxId: true },
  });
  return rows.map((r) => r.mailboxId);
}

// A Prisma `Task` where-clause limiting rows to what `user` may see.
// admin -> all. otherwise: own tasks OR reports' tasks OR mailbox-granted tasks.
export async function visibleTaskWhere(
  user: SessionUser,
): Promise<Prisma.TaskWhereInput> {
  if (user.role === "admin") return {}; // admins see everything

  const [reports, mailboxes] = await Promise.all([
    reportIds(user.id),
    mailboxViewAllIds(user.id),
  ]);

  const or: Prisma.TaskWhereInput[] = [{ ownerId: user.id }];
  if (reports.length) or.push({ ownerId: { in: reports } });
  if (mailboxes.length) or.push({ mailboxId: { in: mailboxes } });
  return { OR: or };
}

// Is a single task visible to the user? (for detail/history/email-update routes)
export async function canViewTask(
  user: SessionUser,
  task: { ownerId: string | null; mailboxId: string | null },
): Promise<boolean> {
  if (user.role === "admin") return true;
  if (task.ownerId === user.id) return true;
  const [reports, mailboxes] = await Promise.all([
    reportIds(user.id),
    mailboxViewAllIds(user.id),
  ]);
  if (task.ownerId && reports.includes(task.ownerId)) return true;
  if (task.mailboxId && mailboxes.includes(task.mailboxId)) return true;
  return false;
}

// Can the user EDIT this task? admin/editAny, own task, or a report's task
// (managers can edit their reports' tasks). `notesOnly` relaxes for members.
export async function canEditTask(
  user: SessionUser,
  task: { ownerId: string | null; mailboxId: string | null },
  opts: { notesOnly?: boolean } = {},
): Promise<boolean> {
  if (can(user.role, "task:editAny")) return true;
  const isOwner = task.ownerId === user.id;
  if (can(user.role, "task:editAssigned") && isOwner) return true;
  // Manager editing a report's task
  if (can(user.role, "task:editAssigned") && task.ownerId) {
    const reports = await reportIds(user.id);
    if (reports.includes(task.ownerId)) return true;
  }
  if (opts.notesOnly && can(user.role, "task:addNotes") && isOwner) return true;
  return false;
}

// Can the user APPROVE/REJECT a suggestion?
// admin, OR canReview on the email's mailbox, OR the suggestion's task is
// visible to the user (managers can approve for tasks they can see).
export async function canReviewSuggestion(
  user: SessionUser,
  suggestion: {
    taskId: string | null;
    task?: { ownerId: string | null; mailboxId: string | null } | null;
    emailUpdate?: { mailboxId: string | null } | null;
  },
): Promise<boolean> {
  if (user.role === "admin") return true;
  // Mailbox review grant (e.g. CMO reviews all cmo mail)
  const mbId = suggestion.emailUpdate?.mailboxId ?? null;
  if (mbId) {
    const reviewable = await mailboxReviewIds(user.id);
    if (reviewable.includes(mbId)) return true;
  }
  // Managers can approve for tasks they can see (own + reports). Requires the
  // review capability — a plain member cannot approve even their own task's
  // suggestions (consistent with the role-gated review queue).
  if (suggestion.task && can(user.role, "review:approve")) {
    return canViewTask(user, suggestion.task);
  }
  return false;
}

// Which saved views can this user use? (drives the UI view switcher)
export type ViewOption = { key: string; label: string };

export async function availableViews(
  user: SessionUser,
): Promise<ViewOption[]> {
  const views: ViewOption[] = [{ key: "my", label: "My Tasks" }];
  const reports = await reportIds(user.id);
  if (reports.length) views.push({ key: "team", label: "My Team" });

  // Named mailbox views the user can see in full (e.g. "CMO Tracker").
  const grants = await prisma.mailboxAccess.findMany({
    where: { userId: user.id, canViewAll: true },
    select: { mailbox: { select: { key: true, displayName: true } } },
  });
  for (const g of grants) {
    views.push({ key: `mailbox:${g.mailbox.key}`, label: `${g.mailbox.displayName} Tracker` });
  }

  if (user.role === "admin") views.push({ key: "all", label: "All Tasks" });
  return views;
}

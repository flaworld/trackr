import "server-only";
import { prisma } from "./db";
import { createTask } from "./tasks";
import { canReviewSuggestion } from "./access";
import type { SessionUser } from "./auth";

// Authorize a user to act on a suggestion (approve/reject/link). Loads the
// suggestion with the context needed for the row-level check.
export async function authorizeSuggestion(
  user: SessionUser,
  suggestionId: string,
): Promise<boolean> {
  const suggestion = await prisma.taskUpdateSuggestion.findUnique({
    where: { id: suggestionId },
    select: {
      taskId: true,
      task: { select: { ownerId: true, mailboxId: true } },
      emailUpdate: { select: { mailboxId: true } },
    },
  });
  if (!suggestion) return false;
  return canReviewSuggestion(user, suggestion);
}

// Approval logic (spec §14). Transactional: update task, write history,
// mark suggestion + email_update approved.
export async function approveSuggestion(
  suggestionId: string,
  reviewerId: string,
) {
  const suggestion = await prisma.taskUpdateSuggestion.findUnique({
    where: { id: suggestionId },
    include: { task: true },
  });
  if (!suggestion) throw new Error("Suggestion not found");
  if (suggestion.reviewStatus !== "pending") {
    throw new Error(`Suggestion already ${suggestion.reviewStatus}.`);
  }
  if (!suggestion.taskId || !suggestion.task) {
    throw new Error(
      "Suggestion is not linked to a task. Link it to a task or create one first.",
    );
  }

  const task = suggestion.task;
  const previousStatus = task.status;
  const previousDueDate = task.dueDate;
  const newStatus = suggestion.suggestedStatus ?? task.status;
  const newDueDate = suggestion.suggestedDueDate ?? task.dueDate;

  await prisma.$transaction([
    prisma.task.update({
      where: { id: suggestion.taskId },
      data: {
        status: newStatus,
        dueDate: newDueDate,
        latestNotes: suggestion.suggestedNotes ?? task.latestNotes,
        lastUpdated: new Date(),
      },
    }),
    prisma.taskHistory.create({
      data: {
        taskId: suggestion.taskId,
        changedById: reviewerId,
        sourceType: "email",
        sourceEmailUpdateId: suggestion.emailUpdateId,
        previousStatus,
        newStatus: suggestion.suggestedStatus ?? null,
        previousDueDate,
        newDueDate: suggestion.suggestedDueDate ?? null,
        notes: suggestion.suggestedNotes,
      },
    }),
    prisma.taskUpdateSuggestion.update({
      where: { id: suggestionId },
      data: {
        reviewStatus: "approved",
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
    }),
    prisma.emailUpdate.update({
      where: { id: suggestion.emailUpdateId },
      data: {
        processingStatus: "approved",
        matchedTaskId: suggestion.taskId,
        processedAt: new Date(),
      },
    }),
  ]);

  return { taskId: suggestion.taskId, newStatus, newDueDate };
}

export async function rejectSuggestion(
  suggestionId: string,
  reviewerId: string,
) {
  const suggestion = await prisma.taskUpdateSuggestion.findUnique({
    where: { id: suggestionId },
  });
  if (!suggestion) throw new Error("Suggestion not found");
  if (suggestion.reviewStatus !== "pending") {
    throw new Error(`Suggestion already ${suggestion.reviewStatus}.`);
  }

  await prisma.$transaction([
    prisma.taskUpdateSuggestion.update({
      where: { id: suggestionId },
      data: {
        reviewStatus: "rejected",
        reviewedById: reviewerId,
        reviewedAt: new Date(),
      },
    }),
    prisma.emailUpdate.update({
      where: { id: suggestion.emailUpdateId },
      data: { processingStatus: "rejected", processedAt: new Date() },
    }),
  ]);
}

// Manually (re)link a suggestion/email to a task (spec §5).
export async function linkSuggestionToTask(
  suggestionId: string,
  taskId: string,
) {
  const suggestion = await prisma.taskUpdateSuggestion.findUnique({
    where: { id: suggestionId },
  });
  if (!suggestion) throw new Error("Suggestion not found");
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error("Target task not found");

  await prisma.$transaction([
    prisma.taskUpdateSuggestion.update({
      where: { id: suggestionId },
      data: { taskId, reviewStatus: "pending" },
    }),
    prisma.emailUpdate.update({
      where: { id: suggestion.emailUpdateId },
      data: { matchedTaskId: taskId, processingStatus: "matched" },
    }),
  ]);
  return { suggestionId, taskId };
}

// Create a brand-new task from an email suggestion, then link it (spec §9).
export async function createTaskFromSuggestion(
  suggestionId: string,
  reviewerId: string,
  taskName?: string,
) {
  const suggestion = await prisma.taskUpdateSuggestion.findUnique({
    where: { id: suggestionId },
    include: { emailUpdate: true },
  });
  if (!suggestion) throw new Error("Suggestion not found");

  const name =
    taskName?.trim() ||
    suggestion.emailUpdate.subject?.replace(/^(re|fwd|fw):\s*/i, "").trim() ||
    "New task from email";

  const task = await createTask({
    taskName: name,
    status: suggestion.suggestedStatus ?? "Not Started",
    dueDate: suggestion.suggestedDueDate ?? null,
    latestNotes: suggestion.suggestedNotes ?? null,
    // Email-created tasks inherit the email's source mailbox.
    mailboxId: suggestion.emailUpdate.mailboxId ?? null,
    createdById: reviewerId,
  });

  await linkSuggestionToTask(suggestionId, task.id);
  return task;
}

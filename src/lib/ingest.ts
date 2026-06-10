// Shared email-ingestion pipeline. Driven by the IMAP worker and by the local
// test-email injector (worker/seed-email.ts). NOT marked server-only so it can
// run in a plain Node process. Steps mirror spec §6 / §13.

import { prisma } from "./db";
import { extractTaskUpdate } from "./extract";
import { matchTask } from "./match";
import { confidenceBand } from "./constants";

export type ParsedEmail = {
  messageId: string;
  mailboxUid?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
  subject?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  receivedAt?: Date | null;
  rawHeaders?: string | null;
  // Which mailbox this arrived in. If omitted, the default inbound mailbox
  // (DEFAULT_INBOUND_MAILBOX_KEY, default "cmo") is resolved.
  mailboxId?: string | null;
  attachments?: Array<{
    filename?: string | null;
    contentType?: string | null;
    size?: number | null;
  }>;
};

// Resolve the source mailbox id for an email (not server-only, so the CLI
// worker can call it).
export async function defaultInboundMailboxId(): Promise<string | null> {
  const key = process.env.DEFAULT_INBOUND_MAILBOX_KEY ?? "cmo";
  const mb = await prisma.mailbox.findUnique({
    where: { key },
    select: { id: true },
  });
  return mb?.id ?? null;
}

export type IngestResult =
  | { status: "skipped"; reason: "duplicate"; messageId: string }
  | {
      status: "ingested";
      emailUpdateId: string;
      suggestionId: string;
      confidence: number;
      matchedTaskId: string | null;
    }
  | { status: "failed"; error: string; messageId: string };

// Map confidence band -> email processing_status (spec §8/§18).
function processingStatusForBand(score: number): string {
  switch (confidenceBand(score)) {
    case "high":
      return "needs_review"; // still requires approval (no auto-apply in V1)
    case "review":
      return "needs_review";
    default:
      return "needs_review"; // unmatched still surfaces in the queue
  }
}

export async function ingestEmail(email: ParsedEmail): Promise<IngestResult> {
  if (!email.messageId) {
    return { status: "failed", error: "missing messageId", messageId: "" };
  }

  // Idempotency (spec §14): skip if message_id already processed.
  const existing = await prisma.emailUpdate.findUnique({
    where: { messageId: email.messageId },
    select: { id: true },
  });
  if (existing) {
    return { status: "skipped", reason: "duplicate", messageId: email.messageId };
  }

  // Resolve which mailbox this email belongs to (source stream).
  const mailboxId = email.mailboxId ?? (await defaultInboundMailboxId());

  try {
    // 1) Persist the raw email (spec step: store in email_updates).
    const emailUpdate = await prisma.emailUpdate.create({
      data: {
        messageId: email.messageId,
        mailboxUid: email.mailboxUid ?? null,
        fromEmail: email.fromEmail ?? null,
        fromName: email.fromName ?? null,
        subject: email.subject ?? null,
        bodyText: email.bodyText ?? null,
        bodyHtml: email.bodyHtml ?? null,
        receivedAt: email.receivedAt ?? new Date(),
        rawHeaders: email.rawHeaders ?? null,
        mailboxId,
        processingStatus: "parsed",
      },
    });

    // attachments
    if (email.attachments?.length) {
      await prisma.emailAttachment.createMany({
        data: email.attachments.map((a) => ({
          emailUpdateId: emailUpdate.id,
          filename: a.filename ?? null,
          contentType: a.contentType ?? null,
          fileSize: a.size ?? null,
        })),
      });
    }

    // 2) Extract update info (spec §7).
    const extraction = extractTaskUpdate({
      subject: email.subject ?? "",
      body: email.bodyText ?? "",
    });

    // 3) Match against tasks (spec §8), scoped to this email's mailbox.
    const match = await matchTask(
      extraction,
      {
        subject: email.subject ?? "",
        body: email.bodyText ?? "",
        fromEmail: email.fromEmail ?? null,
      },
      mailboxId,
    );

    const procStatus = processingStatusForBand(match.confidence);

    // 4) Record extraction results + matched task on the email.
    await prisma.emailUpdate.update({
      where: { id: emailUpdate.id },
      data: {
        processingStatus: procStatus,
        matchedTaskId: match.taskId,
        matchConfidence: match.confidence,
        extractedStatus: extraction.status,
        extractedDueDate: extraction.dueDate,
        extractedSummary: extraction.summary,
        processedAt: new Date(),
      },
    });

    // 5) Create the suggestion (pending). No auto-apply in V1 (spec §17).
    const suggestion = await prisma.taskUpdateSuggestion.create({
      data: {
        emailUpdateId: emailUpdate.id,
        taskId: match.taskId,
        suggestedStatus: extraction.status,
        suggestedDueDate: extraction.dueDate,
        suggestedNotes: extraction.summary,
        confidenceScore: match.confidence,
        reason: match.reason,
        reviewStatus: "pending",
      },
    });

    return {
      status: "ingested",
      emailUpdateId: emailUpdate.id,
      suggestionId: suggestion.id,
      confidence: match.confidence,
      matchedTaskId: match.taskId,
    };
  } catch (err) {
    // Record the failure against the email if it was created; otherwise log.
    const message = err instanceof Error ? err.message : String(err);
    await prisma.emailUpdate
      .update({
        where: { messageId: email.messageId },
        data: { processingStatus: "failed", errorMessage: message },
      })
      .catch(() => {/* email row may not exist */});
    return { status: "failed", error: message, messageId: email.messageId };
  }
}

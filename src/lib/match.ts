// Task matching logic (spec §8). Produces a confidence score 0-100 and a
// human-readable reason. Kept pure (operates on a supplied candidate list) so
// it is testable; loadCandidates() is the thin Prisma adapter.

import { prisma } from "./db";
import type { ExtractedUpdate } from "./extract";

export type Candidate = {
  id: string;
  taskCode: string;
  taskName: string;
  ownerEmail: string | null;
};

export type MatchResult = {
  taskId: string | null;
  confidence: number;
  reason: string;
};

// --- text utilities ---
const STOP = new Set([
  "the", "a", "an", "to", "of", "for", "and", "or", "in", "on", "with", "by",
  "update", "re", "fwd", "fw", "task", "please", "pls", "status",
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/\[?task-\d+\]?/gi, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

// Dice coefficient over token sets — robust to word order and minor extras.
function similarity(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return (2 * inter) / (ta.size + tb.size);
}

const RELATED_KEYWORDS = [
  "update", "status", "progress", "done", "complete", "blocked", "waiting",
  "due", "deadline", "review", "launch", "publish", "campaign",
];

export function scoreMatch(
  extraction: ExtractedUpdate,
  email: { subject: string; body: string; fromEmail: string | null },
  candidates: Candidate[],
): MatchResult {
  const subject = email.subject ?? "";
  const body = email.body ?? "";
  const haystack = `${subject}\n${body}`.toLowerCase();
  const fromEmail = (email.fromEmail ?? "").toLowerCase();

  // Tier 1 — exact task code (95-100)
  if (extraction.taskCode) {
    const byCode = candidates.find(
      (c) => c.taskCode.toUpperCase() === extraction.taskCode!.toUpperCase(),
    );
    if (byCode) {
      const bracketed = new RegExp(`\\[\\s*${extraction.taskCode}\\s*\\]`, "i").test(
        haystack,
      );
      return {
        taskId: byCode.id,
        confidence: bracketed ? 100 : 97,
        reason: `Exact task code ${byCode.taskCode} found in email.`,
      };
    }
    // Code present but matches no task -> leave unmatched, note it.
    return {
      taskId: null,
      confidence: 20,
      reason: `Task code ${extraction.taskCode} referenced but no matching task exists.`,
    };
  }

  // Score every candidate by name presence / similarity / owner+keywords.
  let best: { c: Candidate; score: number; reason: string } | null = null;

  for (const c of candidates) {
    const nameLower = c.taskName.toLowerCase();
    let score = 0;
    let reason = "";

    // Tier 2 — exact task name appears in subject/body (85-95)
    if (nameLower.length > 3 && haystack.includes(nameLower)) {
      const inSubject = subject.toLowerCase().includes(nameLower);
      score = inSubject ? 93 : 88;
      reason = `Task name "${c.taskName}" found verbatim in ${inSubject ? "subject" : "body"}.`;
    } else {
      // Tier 3 — close text similarity (65-85)
      const sim = Math.max(
        similarity(subject, c.taskName),
        similarity(`${subject} ${body}`, c.taskName) * 0.95,
      );
      if (sim >= 0.4) {
        score = Math.round(65 + (sim - 0.4) * (85 - 65) / 0.6);
        score = Math.min(85, score);
        reason = `High text similarity (${Math.round(sim * 100)}%) with "${c.taskName}".`;
      }

      // Tier 4 — sender is task owner + related keywords (50-70)
      const ownerMatch =
        c.ownerEmail && fromEmail && c.ownerEmail.toLowerCase() === fromEmail;
      const kw = RELATED_KEYWORDS.some((k) => haystack.includes(k));
      if (ownerMatch && kw) {
        const ownerScore = sim >= 0.2 ? 70 : 58;
        if (ownerScore > score) {
          score = ownerScore;
          reason = `Sender is task owner and update keywords present (partial name match).`;
        }
      } else if (ownerMatch && score === 0) {
        score = 50;
        reason = `Sender is task owner but no strong content match.`;
      }
    }

    if (score > 0 && (!best || score > best.score)) {
      best = { c, score, reason };
    }
  }

  if (best) {
    return { taskId: best.c.id, confidence: best.score, reason: best.reason };
  }

  // Tier 5 — weak / no match (below 50)
  return {
    taskId: null,
    confidence: 0,
    reason: "No task code, name, or owner match found.",
  };
}

// Prisma adapter: load active (non-archived) tasks as match candidates.
// When `mailboxId` is given, restrict candidates to that mailbox so an email
// to tracker-cmo@ only matches CMO tasks, not OM/General (precision at scale).
export async function loadCandidates(
  mailboxId?: string | null,
): Promise<Candidate[]> {
  const tasks = await prisma.task.findMany({
    where: {
      archivedAt: null,
      ...(mailboxId ? { mailboxId } : {}),
    },
    select: {
      id: true,
      taskCode: true,
      taskName: true,
      owner: { select: { email: true } },
    },
  });
  return tasks.map((t) => ({
    id: t.id,
    taskCode: t.taskCode,
    taskName: t.taskName,
    ownerEmail: t.owner?.email ?? null,
  }));
}

export async function matchTask(
  extraction: ExtractedUpdate,
  email: { subject: string; body: string; fromEmail: string | null },
  mailboxId?: string | null,
): Promise<MatchResult> {
  const candidates = await loadCandidates(mailboxId);
  return scoreMatch(extraction, email, candidates);
}

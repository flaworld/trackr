// Email parsing rules (spec §7). Pure, dependency-free functions so they can be
// unit-tested and reused by the worker and the "create task from email" flow.

export type ExtractedUpdate = {
  taskCode: string | null;
  status: string | null;
  dueDate: Date | null;
  summary: string | null;
  forwardedFrom: string | null;
};

// --- Status detection: phrase -> status (spec §7) ---
// Order matters: more specific / "later-stage" statuses are checked first so
// that e.g. "completed" wins over a stray "started".
const STATUS_KEYWORDS: Array<{ status: string; phrases: string[] }> = [
  {
    status: "Completed",
    phrases: [
      "completed",
      "complete",
      "done",
      "published",
      "launched",
      "approved",
      "finished",
      "shipped",
      "live now",
      "wrapped up",
    ],
  },
  {
    status: "Blocked",
    phrases: [
      "blocked",
      "stuck",
      "cannot proceed",
      "can't proceed",
      "dependency pending",
      "on hold",
      "held up",
    ],
  },
  {
    status: "Waiting for Input",
    phrases: [
      "waiting for approval",
      "waiting for input",
      "pending feedback",
      "awaiting client response",
      "awaiting feedback",
      "needs review",
      "need review",
      "waiting on",
      "awaiting approval",
    ],
  },
  {
    status: "In Progress",
    phrases: [
      "working on it",
      "in progress",
      "underway",
      "started",
      "ongoing",
      "making progress",
      "wip",
    ],
  },
  {
    status: "Not Started",
    phrases: ["not started", "yet to begin", "planned", "haven't started", "not begun"],
  },
];

export function detectStatus(text: string): string | null {
  const hay = ` ${text.toLowerCase()} `;
  for (const { status, phrases } of STATUS_KEYWORDS) {
    for (const phrase of phrases) {
      if (hay.includes(` ${phrase} `) || hay.includes(`${phrase}.`) ||
          hay.includes(`${phrase},`) || hay.includes(`${phrase}!`)) {
        return status;
      }
      // also match phrase appearing as substring for multi-word phrases
      if (phrase.includes(" ") && hay.includes(phrase)) return status;
    }
  }
  return null;
}

// --- Task code: TASK-104 or [TASK-104] (spec §7) ---
const TASK_CODE_RE = /\[?\s*(TASK-\d+)\s*\]?/i;

export function detectTaskCode(text: string): string | null {
  const m = text.match(TASK_CODE_RE);
  return m ? m[1].toUpperCase() : null;
}

// --- Due date: parse common phrasings into a Date ---
const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

// Reference "now" is injectable for testability.
export function detectDueDate(text: string, now: Date = new Date()): Date | null {
  const lower = text.toLowerCase();

  // Only treat dates as a *due* date when near a due-ish cue word, to avoid
  // grabbing the email's own sent date or unrelated dates.
  const cue = /(due|by|deadline|complete by|finish by|target|eta|expected)/i;
  if (!cue.test(lower)) {
    // still allow explicit "due date:" style handled below
  }

  // 1) ISO: 2026-07-15
  const iso = lower.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (!isNaN(d.getTime())) return d;
  }

  // 2) "July 15" / "15 July" / "Jul 15, 2026"
  const monthName = Object.keys(MONTHS).join("|");
  const md = lower.match(
    new RegExp(`\\b(${monthName})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s*(\\d{4}))?`, "i"),
  );
  const dm = lower.match(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthName})\\.?(?:,?\\s*(\\d{4}))?`, "i"),
  );
  const buildFromMonth = (mon: string, day: number, yr?: string): Date | null => {
    const month = MONTHS[mon.replace(".", "")];
    if (month === undefined) return null;
    let year = yr ? Number(yr) : now.getFullYear();
    let d = new Date(year, month, day);
    // If no year given and the date is in the past, assume next year.
    if (!yr && d.getTime() < now.getTime() - 24 * 60 * 60 * 1000) {
      year += 1;
      d = new Date(year, month, day);
    }
    return isNaN(d.getTime()) ? null : d;
  };
  if (md) {
    const d = buildFromMonth(md[1], Number(md[2]), md[3]);
    if (d) return d;
  }
  if (dm) {
    const d = buildFromMonth(dm[2], Number(dm[1]), dm[3]);
    if (d) return d;
  }

  // 3) Numeric: 07/15/2026 or 15/07/2026 (assume M/D/Y for ambiguous US format)
  const numeric = lower.match(/\b(\d{1,2})\/(\d{1,2})\/(\d{2,4})\b/);
  if (numeric) {
    let [, a, b, y] = numeric;
    let year = Number(y);
    if (year < 100) year += 2000;
    const d = new Date(year, Number(a) - 1, Number(b));
    if (!isNaN(d.getTime())) return d;
  }

  // 4) Relative: "tomorrow", "in 3 days", "next week", "end of week/month"
  if (/\btomorrow\b/.test(lower)) return addDays(now, 1);
  if (/\btoday\b/.test(lower) && cue.test(lower)) return addDays(now, 0);
  const inDays = lower.match(/\bin\s+(\d{1,3})\s+days?\b/);
  if (inDays) return addDays(now, Number(inDays[1]));
  const inWeeks = lower.match(/\bin\s+(\d{1,2})\s+weeks?\b/);
  if (inWeeks) return addDays(now, Number(inWeeks[1]) * 7);
  if (/\bnext week\b/.test(lower)) return addDays(now, 7);
  if (/\bend of (the )?week\b/.test(lower)) return endOfWeek(now);
  if (/\bend of (the )?month\b/.test(lower)) return endOfMonth(now);

  return null;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setHours(12, 0, 0, 0);
  x.setDate(x.getDate() + n);
  return x;
}
function endOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay(); // 0 Sun .. 6 Sat
  const toFriday = (5 - day + 7) % 7;
  return addDays(x, toFriday);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 12, 0, 0, 0);
}

// --- Forwarded original sender ---
export function detectForwardedFrom(text: string): string | null {
  // Match "From: Name <email>" blocks common in forwarded mail.
  const m = text.match(/^\s*From:\s*.*?<([^>]+@[^>]+)>/im) ||
    text.match(/^\s*From:\s*([^\s<]+@[^\s>]+)/im);
  return m ? m[1].trim() : null;
}

// --- Short summary: first meaningful line, trimmed of forwarding chrome ---
export function buildSummary(subject: string, body: string): string | null {
  const cleanBody = body
    .replace(/^>.*$/gm, "") // quoted lines
    .replace(/^\s*(On .+wrote:|-----Original Message-----).*$/gim, "")
    .split(/\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^(from|to|sent|subject|date|cc):/i.test(l))
    .join(" ")
    .trim();

  const base = cleanBody || subject || "";
  if (!base) return null;
  return base.length > 280 ? base.slice(0, 277).trimEnd() + "…" : base;
}

// --- Top-level extraction (spec §13 calls extractTaskUpdate) ---
export function extractTaskUpdate(input: {
  subject: string;
  body: string;
  now?: Date;
}): ExtractedUpdate {
  const { subject, body } = input;
  const now = input.now ?? new Date();
  const combined = `${subject}\n${body}`;
  return {
    taskCode: detectTaskCode(combined),
    status: detectStatus(combined),
    dueDate: detectDueDate(combined, now),
    summary: buildSummary(subject, body),
    forwardedFrom: detectForwardedFrom(body),
  };
}

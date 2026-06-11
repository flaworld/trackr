// Client-safe formatting + style helpers (no server-only imports).

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// For <input type="date"> values (YYYY-MM-DD).
export function toDateInput(d: string | Date | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export const STATUS_STYLES: Record<string, string> = {
  "Not Started":
    "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  "In Progress": "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "Waiting for Input":
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  Blocked: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  Completed:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  Overdue: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300",
};

export const STATUS_DOTS: Record<string, string> = {
  "Not Started": "bg-slate-400",
  "In Progress": "bg-blue-500",
  "Waiting for Input": "bg-amber-500",
  Blocked: "bg-red-500",
  Completed: "bg-emerald-500",
  Overdue: "bg-rose-500",
};

export const PRIORITY_STYLES: Record<string, string> = {
  Low: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  Medium: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  High: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  Urgent: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
};

export function confidenceStyle(score: number): string {
  if (score >= 80)
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300";
  if (score >= 50)
    return "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300";
  return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

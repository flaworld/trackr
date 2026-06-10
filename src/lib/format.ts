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
  "Not Started": "bg-slate-100 text-slate-700 ring-slate-200",
  "In Progress": "bg-blue-100 text-blue-700 ring-blue-200",
  "Waiting for Input": "bg-amber-100 text-amber-800 ring-amber-200",
  Blocked: "bg-red-100 text-red-700 ring-red-200",
  Completed: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  Overdue: "bg-rose-100 text-rose-800 ring-rose-300",
};

export const PRIORITY_STYLES: Record<string, string> = {
  Low: "bg-slate-100 text-slate-600 ring-slate-200",
  Medium: "bg-sky-100 text-sky-700 ring-sky-200",
  High: "bg-orange-100 text-orange-700 ring-orange-200",
  Urgent: "bg-red-100 text-red-700 ring-red-200",
};

export function confidenceStyle(score: number): string {
  if (score >= 80) return "bg-emerald-100 text-emerald-700 ring-emerald-200";
  if (score >= 50) return "bg-amber-100 text-amber-800 ring-amber-200";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

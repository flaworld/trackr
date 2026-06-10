import {
  STATUS_STYLES,
  PRIORITY_STYLES,
  confidenceStyle,
} from "@/lib/format";
import { confidenceLabel } from "@/lib/constants";

export function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-700 ring-slate-200";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const cls =
    PRIORITY_STYLES[priority] ?? "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${cls}`}
    >
      {priority}
    </span>
  );
}

export function ConfidenceBadge({ score }: { score: number }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${confidenceStyle(
        score,
      )}`}
      title={confidenceLabel(score)}
    >
      {score}% · {confidenceLabel(score)}
    </span>
  );
}

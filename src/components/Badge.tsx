import {
  STATUS_STYLES,
  STATUS_DOTS,
  PRIORITY_STYLES,
  confidenceStyle,
} from "@/lib/format";
import { confidenceLabel } from "@/lib/constants";
import { cn } from "@/lib/cn";

export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        STATUS_STYLES[status] ?? "bg-muted text-muted-foreground",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOTS[status] ?? "bg-slate-400")} />
      {status}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        PRIORITY_STYLES[priority] ?? "bg-muted text-muted-foreground",
      )}
    >
      {priority}
    </span>
  );
}

export function ConfidenceBadge({ score }: { score: number }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
        confidenceStyle(score),
      )}
      title={confidenceLabel(score)}
    >
      {score}% · {confidenceLabel(score)}
    </span>
  );
}

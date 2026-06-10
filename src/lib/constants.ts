// Shared enum-like constants. SQLite has no native enums, so these are the
// single source of truth for valid values across the app + worker.

export const TASK_STATUSES = [
  "Not Started",
  "In Progress",
  "Waiting for Input",
  "Blocked",
  "Completed",
  "Overdue",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

// "Overdue" is a derived/display status (computed from dueDate when a task is
// not completed). It is not normally written directly by manual edits, but the
// email parser may surface it. Statuses an email can suggest:
export const EMAIL_SUGGESTABLE_STATUSES = [
  "Not Started",
  "In Progress",
  "Waiting for Input",
  "Blocked",
  "Completed",
] as const;

export const PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const ROLES = ["admin", "manager", "member", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export const PROCESSING_STATUSES = [
  "received",
  "parsed",
  "matched",
  "needs_review",
  "approved",
  "rejected",
  "failed",
] as const;
export type ProcessingStatus = (typeof PROCESSING_STATUSES)[number];

export const REVIEW_STATUSES = ["pending", "approved", "rejected"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const SOURCE_TYPES = ["manual", "email", "system"] as const;
export type SourceType = (typeof SOURCE_TYPES)[number];

// Confidence banding (spec §8 / §18)
export const CONFIDENCE = {
  HIGH: 80, // >= 80  -> "High confidence"
  REVIEW: 50, // 50-79  -> "Needs review"; < 50 -> "Unmatched email"
} as const;

export function confidenceBand(score: number): "high" | "review" | "unmatched" {
  if (score >= CONFIDENCE.HIGH) return "high";
  if (score >= CONFIDENCE.REVIEW) return "review";
  return "unmatched";
}

export function confidenceLabel(score: number): string {
  switch (confidenceBand(score)) {
    case "high":
      return "High confidence";
    case "review":
      return "Needs review";
    default:
      return "Unmatched email";
  }
}

// --- Role → permission matrix (spec §11) ---
export type Permission =
  | "task:create"
  | "task:editAny"
  | "task:editAssigned"
  | "task:addNotes"
  | "review:approve"
  | "users:manage"
  | "view";

const PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    "task:create",
    "task:editAny",
    "task:editAssigned",
    "task:addNotes",
    "review:approve",
    "users:manage",
    "view",
  ],
  manager: [
    "task:create",
    "task:editAny",
    "task:editAssigned",
    "task:addNotes",
    "review:approve",
    "view",
  ],
  member: ["task:editAssigned", "task:addNotes", "view"],
  viewer: ["view"],
};

export function can(role: string | undefined, perm: Permission): boolean {
  if (!role) return false;
  return PERMISSIONS[role as Role]?.includes(perm) ?? false;
}

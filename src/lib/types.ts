// Client-facing shapes (JSON-serialised; dates are ISO strings).

export type UserLite = {
  id: string;
  name: string;
  email: string;
  role?: string;
};

export type MailboxLite = {
  id: string;
  key: string;
  displayName: string;
};

export type TaskRow = {
  id: string;
  taskCode: string;
  assignedDate: string;
  taskName: string;
  ownerId: string | null;
  owner: UserLite | null;
  mailboxId: string | null;
  mailbox: MailboxLite | null;
  status: string;
  displayStatus: string;
  isOverdue: boolean;
  priority: string;
  dueDate: string | null;
  lastUpdated: string;
  latestNotes: string | null;
  _count?: { suggestions: number; matchedEmails: number };
};

export type ViewOption = { key: string; label: string };

export type MailboxAdmin = {
  id: string;
  key: string;
  displayName: string;
  inbound: boolean;
};

export type MailboxAdminRow = {
  id: string;
  key: string;
  displayName: string;
  address: string | null;
  inbound: boolean;
  active: boolean;
  imapHost: string | null;
  imapPort: number | null;
  imapSecure: boolean;
  imapUser: string | null;
  allowSelfSigned: boolean;
  processedFolder: string | null;
  failedFolder: string | null;
  moveProcessed: boolean;
  passwordEnvVar: string;
  passwordSet: boolean | null;
  _count: { tasks: number; emailUpdates: number };
};

export type AdminGrant = {
  mailboxId: string;
  canViewAll: boolean;
  canReview: boolean;
  mailbox: { key: string; displayName: string };
};

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  managerId: string | null;
  manager: { id: string; name: string; email: string } | null;
  hasPassword: boolean;
  authMethods: string[];
  mailboxAccess: AdminGrant[];
  _count: { reports: number; ownedTasks: number };
};

export type HistoryRow = {
  id: string;
  sourceType: string;
  previousStatus: string | null;
  newStatus: string | null;
  previousDueDate: string | null;
  newDueDate: string | null;
  notes: string | null;
  createdAt: string;
  changedBy: UserLite | null;
  sourceEmail: { id: string; subject: string | null; fromEmail: string | null } | null;
};

export type Attachment = {
  id: string;
  filename: string | null;
  contentType: string | null;
  fileSize: number | null;
};

export type EmailUpdateRow = {
  id: string;
  messageId: string;
  fromEmail: string | null;
  fromName: string | null;
  subject: string | null;
  bodyText: string | null;
  receivedAt: string | null;
  processingStatus: string;
  matchConfidence: number | null;
  extractedStatus: string | null;
  extractedDueDate: string | null;
  extractedSummary: string | null;
  mailbox?: MailboxLite | null;
  attachments: Attachment[];
  suggestions?: Array<{
    id: string;
    reviewStatus: string;
    confidenceScore: number;
    suggestedStatus: string | null;
    suggestedDueDate: string | null;
  }>;
};

export type SuggestionRow = {
  id: string;
  taskId: string | null;
  suggestedStatus: string | null;
  suggestedDueDate: string | null;
  suggestedNotes: string | null;
  confidenceScore: number;
  reason: string | null;
  reviewStatus: string;
  createdAt: string;
  task: { id: string; taskCode: string; taskName: string } | null;
  emailUpdate: EmailUpdateRow;
};

export type Permissions = {
  canCreate: boolean;
  canEditAny: boolean;
  canEditAssigned: boolean;
  canAddNotes: boolean;
  canReview: boolean;
};

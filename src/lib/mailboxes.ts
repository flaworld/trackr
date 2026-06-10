import "server-only";
import { prisma } from "./db";
import { resolveMailboxPassword } from "./imap";

// Admin mailbox management. Connection config lives in the DB; the IMAP password
// is resolved from env (IMAP_PASSWORD_<KEY>) and never stored here.

const FULL_SELECT = {
  id: true,
  key: true,
  displayName: true,
  address: true,
  inbound: true,
  active: true,
  imapHost: true,
  imapPort: true,
  imapSecure: true,
  imapUser: true,
  allowSelfSigned: true,
  processedFolder: true,
  failedFolder: true,
  moveProcessed: true,
} as const;

export async function listMailboxesAdmin() {
  const rows = await prisma.mailbox.findMany({
    orderBy: [{ active: "desc" }, { displayName: "asc" }],
    select: { ...FULL_SELECT, _count: { select: { tasks: true, emailUpdates: true } } },
  });
  // Annotate whether a usable password is resolvable (without revealing it),
  // and the env var name an admin would set.
  return rows.map((m) => ({
    ...m,
    passwordEnvVar: `IMAP_PASSWORD_${m.key.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`,
    passwordSet: m.inbound ? Boolean(resolveMailboxPassword(m)) : null,
  }));
}

export type MailboxInput = {
  key?: string;
  displayName: string;
  address?: string | null;
  inbound: boolean;
  active?: boolean;
  imapHost?: string | null;
  imapPort?: number | null;
  imapSecure?: boolean;
  imapUser?: string | null;
  allowSelfSigned?: boolean;
  processedFolder?: string | null;
  failedFolder?: string | null;
  moveProcessed?: boolean;
};

function normalizeKey(raw: string): string {
  return raw.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function createMailbox(input: MailboxInput & { key: string }) {
  const key = normalizeKey(input.key);
  if (!key) throw new Error("Invalid key");
  return prisma.mailbox.create({
    data: {
      key,
      displayName: input.displayName.trim(),
      address: input.address ?? null,
      inbound: input.inbound,
      active: input.active ?? true,
      imapHost: input.imapHost ?? null,
      imapPort: input.imapPort ?? (input.inbound ? 993 : null),
      imapSecure: input.imapSecure ?? true,
      imapUser: input.imapUser ?? null,
      allowSelfSigned: input.allowSelfSigned ?? false,
      processedFolder: input.processedFolder ?? null,
      failedFolder: input.failedFolder ?? null,
      moveProcessed: input.moveProcessed ?? false,
    },
    select: { id: true, key: true },
  });
}

// Key is immutable after creation (tasks/emails reference the mailbox by id,
// but the key is used for the password env var convention, so we keep it fixed).
export async function updateMailbox(id: string, input: Partial<MailboxInput>) {
  const data: Record<string, unknown> = {};
  for (const k of [
    "displayName",
    "address",
    "inbound",
    "active",
    "imapHost",
    "imapPort",
    "imapSecure",
    "imapUser",
    "allowSelfSigned",
    "processedFolder",
    "failedFolder",
    "moveProcessed",
  ] as const) {
    if (input[k] !== undefined) data[k] = input[k];
  }
  return prisma.mailbox.update({ where: { id }, data, select: { id: true } });
}

export async function getMailboxConfig(id: string) {
  return prisma.mailbox.findUnique({ where: { id }, select: FULL_SELECT });
}

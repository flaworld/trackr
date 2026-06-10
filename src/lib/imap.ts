// IMAP polling core (spec §6, §13, §14) — multi-mailbox.
// Shared by the CLI worker (worker/imap-worker.ts) and the HTTP cron endpoint
// (/api/cron/poll). Node.js runtime only (imports imapflow/mailparser).
//
// Each inbound Mailbox row carries its own connection config; the password is
// resolved from a per-mailbox env var IMAP_PASSWORD_<KEY> (with a legacy
// fallback to IMAP_PASSWORD for the original mailbox). Secrets never live in DB.

import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { prisma } from "./db";
import { ingestEmail, type ParsedEmail } from "./ingest";

export type PollStats = {
  mailbox: string;
  fetched: number;
  ingested: number;
  skipped: number;
  failed: number;
  error?: string;
};

// Mailbox connection config (subset of the Mailbox model used to connect).
export type MailboxConfig = {
  id: string;
  key: string;
  displayName: string;
  imapHost: string | null;
  imapPort: number | null;
  imapSecure: boolean;
  imapUser: string | null;
  allowSelfSigned: boolean;
  processedFolder: string | null;
  failedFolder: string | null;
  moveProcessed: boolean;
};

// Resolve a mailbox's IMAP password from env: IMAP_PASSWORD_<KEY> (uppercased,
// non-alphanumerics → _). Legacy fallback: the global IMAP_PASSWORD, but only
// for the mailbox whose imapUser matches the global IMAP_USER (the original).
export function resolveMailboxPassword(mb: MailboxConfig): string | null {
  const envKey = `IMAP_PASSWORD_${mb.key.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;
  const perKey = process.env[envKey];
  if (perKey) return perKey;
  if (
    process.env.IMAP_PASSWORD &&
    mb.imapUser &&
    process.env.IMAP_USER &&
    mb.imapUser.toLowerCase() === process.env.IMAP_USER.toLowerCase()
  ) {
    return process.env.IMAP_PASSWORD;
  }
  return null;
}

export function makeImapClient(mb: MailboxConfig, password: string): ImapFlow {
  if (!mb.imapHost || !mb.imapUser) {
    throw new Error(`Mailbox "${mb.key}" is missing imapHost/imapUser`);
  }
  return new ImapFlow({
    host: mb.imapHost,
    port: mb.imapPort ?? 993,
    secure: mb.imapSecure,
    auth: { user: mb.imapUser, pass: password },
    logger: false,
    socketTimeout: 30000,
    tls: mb.allowSelfSigned ? { rejectUnauthorized: false } : undefined,
  });
}

async function ensureFolders(client: ImapFlow, names: string[]): Promise<void> {
  try {
    const existing = new Set((await client.list()).map((m) => m.path));
    for (const name of names) {
      if (name && !existing.has(name)) {
        try {
          await client.mailboxCreate(name);
          console.log(`[imap] created folder "${name}"`);
        } catch (e) {
          console.warn(`[imap] could not create folder "${name}":`, e);
        }
      }
    }
  } catch (e) {
    console.warn("[imap] folder check failed:", e);
  }
}

// Process-wide guard so overlapping triggers never run two passes at once.
let polling = false;

// Poll a single mailbox. Stamps its mailboxId on every ingested email and
// routes handled/failed mail to ITS configured folders.
export async function pollMailbox(mb: MailboxConfig): Promise<PollStats> {
  const stats: PollStats = {
    mailbox: mb.key,
    fetched: 0,
    ingested: 0,
    skipped: 0,
    failed: 0,
  };

  const password = resolveMailboxPassword(mb);
  if (!password) {
    stats.error = `no password (set IMAP_PASSWORD_${mb.key.toUpperCase()})`;
    console.warn(`[imap] skipping "${mb.key}": ${stats.error}`);
    return stats;
  }

  const moveProcessed = mb.moveProcessed;
  const processedFolder = mb.processedFolder ?? "Processed";
  const failedFolder = mb.failedFolder ?? "Failed";

  let client: ImapFlow;
  try {
    client = makeImapClient(mb, password);
  } catch (e) {
    stats.error = e instanceof Error ? e.message : String(e);
    return stats;
  }

  try {
    await client.connect();
    if (moveProcessed) await ensureFolders(client, [processedFolder, failedFolder]);

    const lock = await client.getMailboxLock("INBOX");
    try {
      for await (const message of client.fetch(
        { seen: false },
        { uid: true, source: true, envelope: true },
      )) {
        stats.fetched++;
        try {
          const parsed = await simpleParser(message.source as Buffer);
          const email: ParsedEmail = {
            messageId:
              parsed.messageId ??
              `no-id-${mb.key}-${message.uid}-${parsed.subject ?? ""}`.slice(0, 200),
            mailboxUid: String(message.uid),
            fromEmail: parsed.from?.value?.[0]?.address ?? null,
            fromName: parsed.from?.value?.[0]?.name ?? null,
            subject: parsed.subject ?? null,
            bodyText: parsed.text ?? null,
            bodyHtml: typeof parsed.html === "string" ? parsed.html : null,
            receivedAt: parsed.date ?? new Date(),
            rawHeaders:
              typeof parsed.headers !== "undefined"
                ? JSON.stringify(Array.from(parsed.headers.entries()))
                : null,
            mailboxId: mb.id, // <-- stamp THIS mailbox
            attachments: (parsed.attachments ?? []).map((a) => ({
              filename: a.filename ?? null,
              contentType: a.contentType ?? null,
              size: a.size ?? null,
            })),
          };

          const result = await ingestEmail(email);

          if (result.status === "ingested") {
            stats.ingested++;
            await client.messageFlagsAdd(message.uid, ["\\Seen"], { uid: true });
            if (moveProcessed) {
              await client.messageMove(message.uid, processedFolder, { uid: true });
            }
            console.log(
              `[imap:${mb.key}] ingested ${email.messageId} conf=${result.confidence} task=${result.matchedTaskId ?? "—"}`,
            );
          } else if (result.status === "skipped") {
            stats.skipped++;
            await client.messageFlagsAdd(message.uid, ["\\Seen"], { uid: true });
          } else {
            stats.failed++;
            console.error(`[imap:${mb.key}] failed ${email.messageId}: ${result.error}`);
            if (moveProcessed) {
              await client.messageMove(message.uid, failedFolder, { uid: true });
            }
          }
        } catch (err) {
          stats.failed++;
          console.error(`[imap:${mb.key}] error processing uid=${message.uid}:`, err);
        }
      }
    } finally {
      lock.release();
      await client.logout().catch(() => {});
    }
  } catch (e) {
    stats.error = e instanceof Error ? e.message : String(e);
    console.error(`[imap:${mb.key}] connection error:`, stats.error);
  }

  console.log(
    `[imap:${mb.key}] pass — fetched=${stats.fetched} ingested=${stats.ingested} skipped=${stats.skipped} failed=${stats.failed}${stats.error ? ` error=${stats.error}` : ""}`,
  );
  return stats;
}

const MAILBOX_SELECT = {
  id: true,
  key: true,
  displayName: true,
  imapHost: true,
  imapPort: true,
  imapSecure: true,
  imapUser: true,
  allowSelfSigned: true,
  processedFolder: true,
  failedFolder: true,
  moveProcessed: true,
} as const;

// Poll every active inbound mailbox (one pass each). Guarded against overlap.
export async function pollAllMailboxes(): Promise<PollStats[]> {
  if (polling) {
    console.log("[imap] poll already in progress; skipping.");
    return [];
  }
  polling = true;
  try {
    const mailboxes = await prisma.mailbox.findMany({
      where: { inbound: true, active: true },
      select: MAILBOX_SELECT,
    });
    const out: PollStats[] = [];
    for (const mb of mailboxes) {
      out.push(await pollMailbox(mb));
    }
    return out;
  } finally {
    polling = false;
  }
}

// Poll a single mailbox by key (for ?mailbox=<key>).
export async function pollMailboxByKey(key: string): Promise<PollStats | null> {
  const mb = await prisma.mailbox.findFirst({
    where: { key, inbound: true, active: true },
    select: MAILBOX_SELECT,
  });
  if (!mb) return null;
  if (polling) return { mailbox: key, fetched: 0, ingested: 0, skipped: 0, failed: 0, error: "busy" };
  polling = true;
  try {
    return await pollMailbox(mb);
  } finally {
    polling = false;
  }
}

// Read-only connection test for the admin "Test connection" button.
export type TestResult =
  | { ok: true; folders: string[]; inboxTotal: number; inboxUnseen: number }
  | { ok: false; error: string; passwordSet: boolean };

export async function testMailboxConnection(mb: MailboxConfig): Promise<TestResult> {
  const password = resolveMailboxPassword(mb);
  if (!password) {
    return {
      ok: false,
      passwordSet: false,
      error: `No password configured. Set env var IMAP_PASSWORD_${mb.key.toUpperCase()}.`,
    };
  }
  let client: ImapFlow;
  try {
    client = makeImapClient(mb, password);
  } catch (e) {
    return { ok: false, passwordSet: true, error: e instanceof Error ? e.message : String(e) };
  }
  try {
    await client.connect();
    const folders = (await client.list()).map((m) => m.path);
    const status = await client.status("INBOX", { messages: true, unseen: true });
    await client.logout().catch(() => {});
    return {
      ok: true,
      folders,
      inboxTotal: status.messages ?? 0,
      inboxUnseen: status.unseen ?? 0,
    };
  } catch (e) {
    await client.logout().catch(() => {});
    return { ok: false, passwordSet: true, error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * IMAP connection diagnostic — READ ONLY. Verifies credentials, TLS, and shows
 * your folder layout + INBOX counts WITHOUT ingesting or modifying any mail.
 *
 *   npm run imap:test
 *
 * Run this first when wiring up a new mailbox. Once it passes, `npm run worker`
 * will work too.
 */
import "dotenv/config";
import { ImapFlow } from "imapflow";

function mask(s: string | undefined): string {
  if (!s) return "(unset)";
  if (s.length <= 2) return "**";
  return s[0] + "*".repeat(Math.max(1, s.length - 2)) + s[s.length - 1];
}

async function main() {
  const host = process.env.IMAP_HOST;
  const port = Number(process.env.IMAP_PORT ?? 993);
  const secure = (process.env.IMAP_SECURE ?? "true") === "true";
  const user = process.env.IMAP_USER;
  const pass = process.env.IMAP_PASSWORD;
  const allowSelfSigned =
    (process.env.IMAP_ALLOW_SELF_SIGNED ?? "false") === "true";

  console.log("IMAP configuration (from .env):");
  console.log(`  IMAP_HOST              = ${host ?? "(unset)"}`);
  console.log(`  IMAP_PORT              = ${port}`);
  console.log(`  IMAP_SECURE            = ${secure}  ${secure ? "(implicit TLS)" : "(plain/STARTTLS)"}`);
  console.log(`  IMAP_USER              = ${user ?? "(unset)"}`);
  console.log(`  IMAP_PASSWORD          = ${mask(pass)} (${pass?.length ?? 0} chars)`);
  console.log(`  IMAP_ALLOW_SELF_SIGNED = ${allowSelfSigned}${allowSelfSigned ? "  ⚠ cert verification OFF" : ""}`);
  console.log("");

  const missing = ["IMAP_HOST", "IMAP_USER", "IMAP_PASSWORD"].filter(
    (k) => !process.env[k],
  );
  if (missing.length) {
    console.error(`✗ Missing required env vars: ${missing.join(", ")}`);
    console.error("  Edit .env and set them, then re-run `npm run imap:test`.");
    process.exit(1);
  }

  const client = new ImapFlow({
    host: host!,
    port,
    secure,
    auth: { user: user!, pass: pass! },
    logger: false,
    // Fail fast instead of hanging on an unreachable host.
    socketTimeout: 15000,
    // Accept self-signed / internal-CA certs only when explicitly opted in.
    tls: allowSelfSigned ? { rejectUnauthorized: false } : undefined,
  });

  const hint = (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`\n✗ Connection failed: ${msg}\n`);
    if (/auth|login|credentials|AUTHENTICATIONFAILED/i.test(msg)) {
      console.error("  → Authentication problem. Check IMAP_USER / IMAP_PASSWORD.");
      console.error("    Many providers require an app-specific password for IMAP.");
    } else if (/timeout|ETIMEDOUT|ECONNREFUSED|EHOSTUNREACH/i.test(msg)) {
      console.error("  → Network/host problem. Check IMAP_HOST / IMAP_PORT and that");
      console.error("    IMAP is enabled and reachable (firewall/VPN?).");
    } else if (/self.signed|certificate|TLS|SSL|wrong version/i.test(msg)) {
      if (/self.signed|certificate/i.test(msg)) {
        console.error("  → The server's TLS certificate isn't trusted (self-signed or");
        console.error("    internal CA). Common for company-internal mail servers.");
        console.error("    To accept it, set in .env:  IMAP_ALLOW_SELF_SIGNED=true");
        console.error("    then re-run. (This disables cert verification for IMAP only.)");
      } else {
        console.error("  → TLS problem. If the server uses STARTTLS on port 143, set");
        console.error("    IMAP_PORT=143 and IMAP_SECURE=false. For 993 use IMAP_SECURE=true.");
      }
    }
    process.exit(1);
  };

  console.log("Connecting…");
  try {
    await client.connect();
  } catch (err) {
    hint(err);
  }

  console.log("✓ Connected and authenticated.\n");

  try {
    console.log("Mailboxes / folders:");
    const mailboxes = await client.list();
    for (const mailbox of mailboxes) {
      console.log(`  - ${mailbox.path}${mailbox.specialUse ? `  ${mailbox.specialUse}` : ""}`);
    }
    console.log("");

    const lock = await client.getMailboxLock("INBOX");
    try {
      const status = await client.status("INBOX", {
        messages: true,
        unseen: true,
        recent: true,
      });
      console.log("INBOX:");
      console.log(`  total messages : ${status.messages ?? 0}`);
      console.log(`  unseen         : ${status.unseen ?? 0}  ← the worker processes these`);
      console.log(`  recent         : ${status.recent ?? 0}`);
    } finally {
      lock.release();
    }

    // Check the Processed/Failed folders the worker may use.
    const processed = process.env.EMAIL_PROCESSED_FOLDER ?? "Processed";
    const failed = process.env.EMAIL_FAILED_FOLDER ?? "Failed";
    const moveOn = (process.env.EMAIL_MOVE_PROCESSED ?? "false") === "true";
    console.log("");
    console.log(`EMAIL_MOVE_PROCESSED = ${moveOn}`);
    if (moveOn) {
      console.log(
        `  Worker will move handled mail to "${processed}" / failures to "${failed}"`,
      );
      console.log("  (folders are auto-created if missing).");
    } else {
      console.log("  Worker will only flag handled mail \\Seen (no moving). Safer for first runs.");
    }
  } catch (err) {
    console.error("✗ Connected but failed while listing/status:", err);
  } finally {
    await client.logout().catch(() => {});
  }

  console.log("\n✓ Diagnostic complete. If counts look right, run `npm run worker:once`.");
}

main().catch((e) => {
  console.error("Unexpected error:", e);
  process.exit(1);
});

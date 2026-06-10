import { NextRequest, NextResponse } from "next/server";
import { pollAllMailboxes, pollMailboxByKey } from "@/lib/imap";

// Secured cron trigger: runs ONE IMAP poll pass. Point a scheduler (cPanel Cron
// Jobs, an uptime-cron service, GitHub Actions, etc.) at this URL every few
// minutes. No terminal / background process needed.
//
//   */3 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
//                 https://trackr.fwsom.com/api/cron/poll
//
// Auth: send the secret as a Bearer token (preferred) OR as ?key=… for simple
// schedulers that can only fetch a URL. Set CRON_SECRET in the environment.

export const runtime = "nodejs"; // needs Node APIs (imapflow/mailparser)
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false; // refuse to run if not configured
  const header = req.headers.get("authorization") ?? "";
  const bearer = header.replace(/^Bearer\s+/i, "");
  const key = req.nextUrl.searchParams.get("key") ?? "";
  return bearer === secret || key === secret;
}

async function run(req: NextRequest): Promise<NextResponse> {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server." },
      { status: 503 },
    );
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const key = req.nextUrl.searchParams.get("mailbox");
    if (key) {
      const stats = await pollMailboxByKey(key);
      if (!stats) {
        return NextResponse.json(
          { ok: false, error: `No active inbound mailbox "${key}"` },
          { status: 404 },
        );
      }
      return NextResponse.json({ ok: true, mailboxes: [stats] });
    }
    const stats = await pollAllMailboxes();
    return NextResponse.json({ ok: true, mailboxes: stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/poll] error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// Accept GET (simple schedulers) and POST.
export const GET = run;
export const POST = run;

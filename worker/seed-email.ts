/**
 * Local test-email injector — exercises the full ingest → match → suggestion
 * pipeline WITHOUT a live IMAP mailbox, so you can demo the review queue before
 * pointing the worker at real credentials.
 *
 *   npm run seed-email                 # inject the built-in sample set
 *   npm run seed-email -- "TASK-104 is now blocked, waiting for approval"
 *                                      # inject one custom email (as body)
 */
import "dotenv/config";
import { ingestEmail, type ParsedEmail } from "../src/lib/ingest";
import { prisma } from "../src/lib/db";

let counter = 0;
function email(partial: Partial<ParsedEmail> & { subject: string; bodyText: string }): ParsedEmail {
  counter++;
  return {
    messageId: `<test-${Date.now()}-${counter}@trackr.local>`,
    fromEmail: partial.fromEmail ?? "manager@trackr.test",
    fromName: partial.fromName ?? "Morgan Manager",
    receivedAt: new Date(),
    ...partial,
  };
}

const SAMPLES: ParsedEmail[] = [
  email({
    subject: "Re: [TASK-104] paid social campaign",
    bodyText:
      "Hi team, the ad account is finally approved. We are now working on it and the campaign is underway. Targeting end of next week to go live.",
    fromEmail: "manager@trackr.test",
  }),
  email({
    subject: "Newsletter update",
    bodyText:
      "Quick note — the September newsletter is done and was published this morning. Due date was July 15.",
    fromEmail: "member@trackr.test",
  }),
  email({
    subject: "Homepage hero copy",
    bodyText:
      "Still waiting for approval from the brand team on the new hero copy. Pending feedback before we can proceed.",
    fromEmail: "member@trackr.test",
  }),
  email({
    subject: "Random vendor pitch about SEO services",
    bodyText:
      "Hello, we offer amazing SEO services. Please buy our package. This matches no task at all.",
    fromEmail: "spam@vendor.example",
  }),
];

async function main() {
  const custom = process.argv.slice(2).join(" ").trim();
  const toSend: ParsedEmail[] = custom
    ? [email({ subject: custom.slice(0, 80), bodyText: custom })]
    : SAMPLES;

  console.log(`Injecting ${toSend.length} test email(s)…\n`);
  for (const e of toSend) {
    const result = await ingestEmail(e);
    if (result.status === "ingested") {
      console.log(
        `✓ "${e.subject}"\n   confidence=${result.confidence} matchedTask=${result.matchedTaskId ?? "— (unmatched)"} suggestion=${result.suggestionId}`,
      );
    } else if (result.status === "skipped") {
      console.log(`• skipped duplicate "${e.subject}"`);
    } else {
      console.log(`✗ failed "${e.subject}": ${result.error}`);
    }
  }
  console.log(`\nOpen /marketing-tasks/review to approve or reject them.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

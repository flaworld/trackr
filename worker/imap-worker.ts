/**
 * IMAP polling worker — CLI runner (spec §6, §13, §14).
 *
 * The actual polling logic lives in src/lib/imap.ts so it is shared with the
 * HTTP cron endpoint (/api/cron/poll). This file just schedules it.
 *
 * Run continuously:   npm run worker        (polls on WORKER_CRON)
 * Run a single pass:  npm run worker:once   (one pass, then exit — for cron)
 */
import "dotenv/config";
import cron from "node-cron";
import { pollAllMailboxes } from "../src/lib/imap";
import { prisma } from "../src/lib/db";

// Last-resort guards: a stray socket error from one mailbox must never kill
// the whole polling process (Fly parks machines after repeated crashes).
process.on("unhandledRejection", (reason) => {
  console.error("[worker] unhandled rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[worker] uncaught exception:", err);
});

async function main() {
  const runOnce = process.env.RUN_ONCE === "true";
  if (runOnce) {
    await pollAllMailboxes().catch((e) => {
      console.error("[worker] fatal:", e);
      process.exitCode = 1;
    });
    await prisma.$disconnect();
    return;
  }

  const schedule = process.env.WORKER_CRON ?? "*/3 * * * *";
  console.log(`[worker] starting. Schedule: "${schedule}". Running first pass…`);
  const tick = async () => {
    try {
      await pollAllMailboxes(); // has its own concurrency guard
    } catch (e) {
      console.error("[worker] pass error:", e);
    }
  };
  await tick();
  cron.schedule(schedule, tick);
}

// Run only when executed directly (not when imported).
const isDirect = process.argv[1] && process.argv[1].includes("imap-worker");
if (isDirect) {
  main().catch((e) => {
    console.error("[worker] startup error:", e);
    process.exit(1);
  });
}

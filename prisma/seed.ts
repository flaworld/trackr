import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Default password for every seeded user (dev only). Change after first login.
const DEFAULT_PASSWORD = "password123";

async function main() {
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  // --- Mailboxes (source streams) ---
  const general = await prisma.mailbox.upsert({
    where: { key: "general" },
    update: { displayName: "General", inbound: false },
    create: {
      key: "general",
      displayName: "General",
      inbound: false, // not polled — default home for manual tasks
      active: true,
    },
  });
  const cmo = await prisma.mailbox.upsert({
    where: { key: "cmo" },
    update: {
      displayName: "CMO",
      address: process.env.IMAP_USER ?? "tracker-cmo@fwsom.com",
      inbound: true,
    },
    create: {
      key: "cmo",
      displayName: "CMO",
      address: process.env.IMAP_USER ?? "tracker-cmo@fwsom.com",
      inbound: true,
      active: true,
      imapHost: process.env.IMAP_HOST,
      imapPort: process.env.IMAP_PORT ? Number(process.env.IMAP_PORT) : 993,
      imapSecure: (process.env.IMAP_SECURE ?? "true") === "true",
      imapUser: process.env.IMAP_USER,
      allowSelfSigned: (process.env.IMAP_ALLOW_SELF_SIGNED ?? "false") === "true",
      processedFolder: process.env.EMAIL_PROCESSED_FOLDER,
      failedFolder: process.env.EMAIL_FAILED_FOLDER,
      moveProcessed: (process.env.EMAIL_MOVE_PROCESSED ?? "false") === "true",
    },
  });

  // --- Users (with a reporting hierarchy) ---
  // admin (top) ─ manager ─ member ;  cmoLead is the CMO supervisor ; viewer standalone
  const users = [
    { key: "admin", name: "Alex Admin", email: "admin@trackr.test", role: "admin" },
    { key: "manager", name: "Morgan Manager", email: "manager@trackr.test", role: "manager" },
    { key: "member", name: "Riley Member", email: "member@trackr.test", role: "member" },
    { key: "member2", name: "Jordan Member", email: "member2@trackr.test", role: "member" },
    { key: "cmoLead", name: "Casey CMO", email: "cmo@trackr.test", role: "manager" },
    { key: "viewer", name: "Vic Viewer", email: "viewer@trackr.test", role: "viewer" },
  ];

  const u: Record<string, string> = {};
  for (const x of users) {
    const rec = await prisma.user.upsert({
      where: { email: x.email },
      update: { name: x.name, role: x.role },
      create: { name: x.name, email: x.email, role: x.role, password: hash },
    });
    u[x.key] = rec.id;
  }

  // Reporting chain: member + member2 report to manager; manager reports to admin.
  await prisma.user.update({ where: { id: u.manager }, data: { managerId: u.admin } });
  await prisma.user.update({ where: { id: u.member }, data: { managerId: u.manager } });
  await prisma.user.update({ where: { id: u.member2 }, data: { managerId: u.manager } });

  // --- Mailbox access: the CMO lead sees + reviews the ENTIRE cmo stream ---
  await prisma.mailboxAccess.upsert({
    where: { userId_mailboxId: { userId: u.cmoLead, mailboxId: cmo.id } },
    update: { canViewAll: true, canReview: true },
    create: { userId: u.cmoLead, mailboxId: cmo.id, canViewAll: true, canReview: true },
  });

  // --- Tasks (assigned to a source mailbox) ---
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const tasks = [
    { taskCode: "TASK-101", taskName: "Launch Q3 product webinar", ownerId: u.manager, status: "In Progress", priority: "High", dueDate: new Date(now + 5 * day), latestNotes: "Landing page drafted, awaiting design review.", mailboxId: cmo.id },
    { taskCode: "TASK-102", taskName: "Refresh homepage hero copy", ownerId: u.member, status: "Waiting for Input", priority: "Medium", dueDate: new Date(now + 2 * day), latestNotes: "Pending feedback from brand team.", mailboxId: cmo.id },
    { taskCode: "TASK-103", taskName: "Publish September newsletter", ownerId: u.member2, status: "Not Started", priority: "Medium", dueDate: new Date(now + 10 * day), latestNotes: null, mailboxId: cmo.id },
    { taskCode: "TASK-104", taskName: "Run paid social retargeting campaign", ownerId: u.manager, status: "Blocked", priority: "Urgent", dueDate: new Date(now - 1 * day), latestNotes: "Blocked on ad account approval.", mailboxId: cmo.id },
    { taskCode: "TASK-105", taskName: "Update case study PDF assets", ownerId: u.member, status: "Completed", priority: "Low", dueDate: new Date(now - 7 * day), latestNotes: "Published to resources page.", mailboxId: general.id },
    { taskCode: "TASK-106", taskName: "Plan partner co-marketing event", ownerId: u.member2, status: "Not Started", priority: "High", dueDate: new Date(now + 21 * day), latestNotes: null, mailboxId: general.id },
  ];

  for (const t of tasks) {
    await prisma.task.upsert({
      where: { taskCode: t.taskCode },
      update: { mailboxId: t.mailboxId },
      create: {
        ...t,
        createdById: u.admin,
        assignedDate: new Date(now - 3 * day),
        lastUpdated: new Date(now - 1 * day),
      },
    });
  }

  console.log("Seed complete.");
  console.log(`Mailboxes: general (manual), cmo (inbound: ${cmo.address})`);
  console.log(`Users (password: "${DEFAULT_PASSWORD}"):`);
  console.log("  admin     admin@trackr.test    (sees all)");
  console.log("  manager   manager@trackr.test  (sees own + reports: member, member2)");
  console.log("  cmo       cmo@trackr.test      (CMO Tracker: all cmo-sourced tasks)");
  console.log("  member    member@trackr.test   (sees own only)");
  console.log("  member2   member2@trackr.test  (sees own only)");
  console.log("  viewer    viewer@trackr.test   (read-only, own only)");
  console.log(`Tasks: ${tasks.length} (4 cmo, 2 general)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

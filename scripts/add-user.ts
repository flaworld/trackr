/**
 * Provision (or update) a user — used to pre-create accounts for Microsoft SSO
 * before the admin UI exists. SSO-only users need no password.
 *
 *   npm run user:add -- <email> [role] ["Full Name"] [managerEmail]
 *
 * Examples:
 *   npm run user:add -- jane@fwsom.com admin "Jane Doe"
 *   npm run user:add -- bob@fwsom.com member "Bob Lee" jane@fwsom.com
 *
 * role defaults to "member". Pass a 5th arg (manager's email) to set reporting.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ROLES = ["admin", "manager", "member", "viewer"];

async function main() {
  const [emailRaw, roleRaw, nameRaw, managerEmailRaw] = process.argv.slice(2);
  if (!emailRaw) {
    console.error('Usage: npm run user:add -- <email> [role] ["Full Name"] [managerEmail]');
    process.exit(1);
  }
  const email = emailRaw.toLowerCase().trim();
  const role = (roleRaw ?? "member").toLowerCase();
  if (!ROLES.includes(role)) {
    console.error(`Invalid role "${role}". Use one of: ${ROLES.join(", ")}`);
    process.exit(1);
  }
  const name = nameRaw ?? email.split("@")[0];

  let managerId: string | undefined;
  if (managerEmailRaw) {
    const mgr = await prisma.user.findUnique({
      where: { email: managerEmailRaw.toLowerCase().trim() },
    });
    if (!mgr) {
      console.error(`Manager not found: ${managerEmailRaw} (create them first)`);
      process.exit(1);
    }
    managerId = mgr.id;
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { role, name, ...(managerId ? { managerId } : {}), active: true },
    create: { email, role, name, managerId, active: true }, // no password = SSO-only
  });

  console.log(`✓ ${user.email}  role=${user.role}  name="${user.name}"${managerId ? `  manager=${managerEmailRaw}` : ""}`);
  console.log("  This user can now sign in with Microsoft (if their M365 email matches).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

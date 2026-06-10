import "server-only";
import { prisma } from "./db";
import { hashPassword } from "./auth";
import { ROLES, type Role } from "./constants";

// Admin user-management service. All callers must already be gated on the
// "users:manage" permission (admin).

export async function listUsersAdmin() {
  const users = await prisma.user.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      managerId: true,
      entraOid: true,
      password: true, // only to derive hasPassword (not returned raw)
      manager: { select: { id: true, name: true, email: true } },
      mailboxAccess: {
        select: {
          mailboxId: true,
          canViewAll: true,
          canReview: true,
          mailbox: { select: { key: true, displayName: true } },
        },
      },
      _count: { select: { reports: true, ownedTasks: true } },
    },
  });
  return users.map(({ password, ...u }) => ({
    ...u,
    hasPassword: Boolean(password),
    authMethods: [
      Boolean(password) ? "password" : null,
      u.entraOid ? "microsoft" : null,
    ].filter(Boolean) as string[],
  }));
}

function validRole(role: string): role is Role {
  return (ROLES as readonly string[]).includes(role);
}

export async function createUser(input: {
  email: string;
  name?: string;
  role?: string;
  managerId?: string | null;
  password?: string | null;
}) {
  const email = input.email.toLowerCase().trim();
  const role = (input.role ?? "member").toLowerCase();
  if (!validRole(role)) throw new Error(`Invalid role: ${role}`);
  const name = (input.name ?? email.split("@")[0]).trim();
  const password = input.password ? await hashPassword(input.password) : null;
  return prisma.user.create({
    data: { email, name, role, managerId: input.managerId ?? null, password },
    select: { id: true, email: true },
  });
}

export async function updateUser(
  id: string,
  patch: {
    name?: string;
    role?: string;
    managerId?: string | null;
    active?: boolean;
    password?: string | null; // "" clears; non-empty sets
  },
) {
  const data: Record<string, unknown> = {};
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (patch.role !== undefined) {
    const role = patch.role.toLowerCase();
    if (!validRole(role)) throw new Error(`Invalid role: ${role}`);
    data.role = role;
  }
  if (patch.managerId !== undefined) {
    if (patch.managerId === id) throw new Error("A user can't be their own manager.");
    data.managerId = patch.managerId || null;
  }
  if (patch.active !== undefined) data.active = patch.active;
  if (patch.password !== undefined) {
    data.password = patch.password ? await hashPassword(patch.password) : null;
  }
  return prisma.user.update({ where: { id }, data, select: { id: true } });
}

// Replace a user's mailbox grants with the given set (only truthy grants kept).
export async function setMailboxGrants(
  userId: string,
  grants: Array<{ mailboxId: string; canViewAll: boolean; canReview: boolean }>,
) {
  const keep = grants.filter((g) => g.canViewAll || g.canReview);
  await prisma.$transaction([
    prisma.mailboxAccess.deleteMany({ where: { userId } }),
    ...(keep.length
      ? [
          prisma.mailboxAccess.createMany({
            data: keep.map((g) => ({
              userId,
              mailboxId: g.mailboxId,
              canViewAll: g.canViewAll,
              canReview: g.canReview,
            })),
          }),
        ]
      : []),
  ]);
}

// --- CSV import ---------------------------------------------------------------
// Minimal CSV line parser supporting quoted fields with commas and "" escapes.
function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export type CsvRow = {
  email: string;
  name?: string;
  role?: string;
  manager?: string;
};

// Expects a header row containing at least an "email" column. Recognised
// columns: email, name, role, manager (manager = manager's email).
export function parseUsersCsv(text: string): { rows: CsvRow[]; error?: string } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (!lines.length) return { rows: [], error: "Empty file." };

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = {
    email: header.indexOf("email"),
    name: header.indexOf("name"),
    role: header.indexOf("role"),
    manager: header.indexOf("manager"),
  };
  if (idx.email === -1) {
    return { rows: [], error: 'CSV must have a header row with an "email" column.' };
  }
  const rows: CsvRow[] = [];
  for (const line of lines.slice(1)) {
    const cols = parseCsvLine(line);
    const email = cols[idx.email]?.toLowerCase().trim();
    if (!email) continue;
    rows.push({
      email,
      name: idx.name >= 0 ? cols[idx.name] : undefined,
      role: idx.role >= 0 ? cols[idx.role]?.toLowerCase() : undefined,
      manager: idx.manager >= 0 ? cols[idx.manager]?.toLowerCase().trim() : undefined,
    });
  }
  return { rows };
}

export type ImportResult = {
  created: number;
  updated: number;
  errors: Array<{ email: string; message: string }>;
};

// Two-pass import: upsert all users first, then resolve manager relationships
// (so a manager listed lower in the file still links correctly).
export async function importUsersCsv(text: string): Promise<ImportResult> {
  const { rows, error } = parseUsersCsv(text);
  const result: ImportResult = { created: 0, updated: 0, errors: [] };
  if (error) {
    result.errors.push({ email: "(file)", message: error });
    return result;
  }

  // Pass 1: upsert users (email, name, role).
  for (const r of rows) {
    const role = (r.role ?? "member").toLowerCase();
    if (!validRole(role)) {
      result.errors.push({ email: r.email, message: `invalid role "${r.role}"` });
      continue;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email)) {
      result.errors.push({ email: r.email, message: "invalid email" });
      continue;
    }
    const name = (r.name || r.email.split("@")[0]).trim();
    const existing = await prisma.user.findUnique({ where: { email: r.email } });
    await prisma.user.upsert({
      where: { email: r.email },
      update: { name, role, active: true },
      create: { email: r.email, name, role, active: true },
    });
    if (existing) result.updated++;
    else result.created++;
  }

  // Pass 2: resolve managers.
  for (const r of rows) {
    if (!r.manager) continue;
    if (r.manager === r.email) {
      result.errors.push({ email: r.email, message: "can't be own manager" });
      continue;
    }
    const mgr = await prisma.user.findUnique({ where: { email: r.manager } });
    if (!mgr) {
      result.errors.push({
        email: r.email,
        message: `manager "${r.manager}" not found`,
      });
      continue;
    }
    await prisma.user.update({
      where: { email: r.email },
      data: { managerId: mgr.id },
    });
  }

  return result;
}

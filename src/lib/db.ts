import { PrismaClient } from "@prisma/client";

// Prisma client singleton (PostgreSQL). The singleton avoids exhausting the
// connection pool during dev hot-reloads. The Next.js app and the standalone
// IMAP worker connect as separate clients to the same Postgres database.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

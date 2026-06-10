import { NextRequest, NextResponse } from "next/server";
import { handle } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { canReviewSuggestion } from "@/lib/access";
import { prisma } from "@/lib/db";

// GET /api/email-updates/review — pending suggestions the user may review
// (spec §5/§9), scoped by mailbox grant + task visibility. Optional
// ?band=high|review|unmatched and ?mailbox=<key> filters.
export const GET = handle(async (req: NextRequest) => {
  const user = await requireUser();
  const band = req.nextUrl.searchParams.get("band");
  const mailboxKey = req.nextUrl.searchParams.get("mailbox");

  const where: {
    reviewStatus: string;
    confidenceScore?: { gte?: number; lt?: number };
    emailUpdate?: { mailbox: { key: string } };
  } = { reviewStatus: "pending" };
  if (band === "high") where.confidenceScore = { gte: 80 };
  else if (band === "review") where.confidenceScore = { gte: 50, lt: 80 };
  else if (band === "unmatched") where.confidenceScore = { lt: 50 };
  if (mailboxKey) where.emailUpdate = { mailbox: { key: mailboxKey } };

  const all = await prisma.taskUpdateSuggestion.findMany({
    where,
    orderBy: [{ confidenceScore: "desc" }, { createdAt: "desc" }],
    include: {
      task: {
        select: {
          id: true,
          taskCode: true,
          taskName: true,
          ownerId: true,
          mailboxId: true,
        },
      },
      emailUpdate: {
        include: {
          attachments: true,
          mailbox: { select: { id: true, key: true, displayName: true } },
        },
      },
    },
  });

  // Row-level scope: only suggestions this user is allowed to review.
  const visible = [];
  for (const s of all) {
    if (await canReviewSuggestion(user, s)) visible.push(s);
  }
  return NextResponse.json({ suggestions: visible });
});

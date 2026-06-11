import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/constants";
import { canReviewSuggestion } from "@/lib/access";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function MarketingTasksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/marketing-tasks");

  const canReview = can(user.role, "review:approve");
  // Badge reflects only suggestions THIS user may review (row-level scope).
  let pendingCount = 0;
  if (canReview) {
    const pending = await prisma.taskUpdateSuggestion.findMany({
      where: { reviewStatus: "pending" },
      select: {
        taskId: true,
        task: { select: { ownerId: true, mailboxId: true } },
        emailUpdate: { select: { mailboxId: true } },
      },
    });
    for (const s of pending) {
      if (await canReviewSuggestion(user, s)) pendingCount++;
    }
  }

  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.role }}
      pendingCount={pendingCount}
      canReview={canReview}
      canManageUsers={can(user.role, "users:manage")}
    >
      {children}
    </AppShell>
  );
}

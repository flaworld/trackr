import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { can } from "@/lib/constants";
import { availableViews } from "@/lib/access";
import { TrackerClient } from "@/components/TrackerClient";
import type { Permissions } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function TrackerPage() {
  const user = (await getCurrentUser())!; // layout guarantees auth

  const [users, mailboxes, views] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.mailbox.findMany({
      where: { active: true },
      orderBy: { displayName: "asc" },
      select: { id: true, key: true, displayName: true },
    }),
    availableViews(user),
  ]);

  const perms: Permissions = {
    canCreate: can(user.role, "task:create"),
    canEditAny: can(user.role, "task:editAny"),
    canEditAssigned: can(user.role, "task:editAssigned"),
    canAddNotes: can(user.role, "task:addNotes"),
    canReview: can(user.role, "review:approve"),
  };

  return (
    <TrackerClient
      users={users}
      mailboxes={mailboxes}
      views={views}
      perms={perms}
      currentUserId={user.id}
    />
  );
}

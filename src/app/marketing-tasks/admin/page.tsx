import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/constants";
import { AdminClient } from "@/components/AdminClient";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = (await getCurrentUser())!;
  if (!can(user.role, "users:manage")) redirect("/marketing-tasks");
  return <AdminClient currentUserId={user.id} />;
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/constants";
import { AdminTabs } from "@/components/AdminTabs";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "users:manage")) redirect("/marketing-tasks");
  return (
    <div>
      <AdminTabs />
      {children}
    </div>
  );
}

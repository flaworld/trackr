import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { can } from "@/lib/constants";
import { ReviewClient } from "@/components/ReviewClient";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const user = (await getCurrentUser())!;
  if (!can(user.role, "review:approve")) {
    // Members/viewers can't approve — send them back to the tracker.
    redirect("/marketing-tasks");
  }
  return <ReviewClient />;
}

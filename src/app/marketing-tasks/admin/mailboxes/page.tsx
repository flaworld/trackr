import { MailboxAdminClient } from "@/components/MailboxAdminClient";

export const dynamic = "force-dynamic";

// Auth/admin gate handled by the admin layout.
export default function MailboxesAdminPage() {
  return <MailboxAdminClient />;
}

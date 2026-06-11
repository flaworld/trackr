"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/marketing-tasks/admin", label: "Users" },
  { href: "/marketing-tasks/admin/mailboxes", label: "Mailboxes" },
];

export function AdminTabs() {
  const pathname = usePathname();
  return (
    <div className="mb-8">
      <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
      <div className="mt-4 flex gap-1 border-b">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

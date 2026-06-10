"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type HeaderUser = { name: string; email: string; role: string };

export function AppHeader({
  user,
  pendingCount,
  canReview,
  canManageUsers,
}: {
  user: HeaderUser;
  pendingCount: number;
  canReview: boolean;
  canManageUsers: boolean;
}) {
  const pathname = usePathname();
  const link = (href: string, label: string, badge?: number) => {
    const active = pathname === href;
    return (
      <Link
        href={href}
        className={`relative rounded-lg px-3 py-1.5 text-sm font-medium transition ${
          active
            ? "bg-brand-50 text-brand-700"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        {label}
        {badge ? (
          <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-semibold text-white">
            {badge}
          </span>
        ) : null}
      </Link>
    );
  };

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/marketing-tasks" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              MT
            </span>
            <span className="hidden text-sm font-semibold text-slate-900 sm:block">
              Marketing Task Tracker
            </span>
          </Link>
          <nav className="flex items-center gap-1">
            {link("/marketing-tasks", "Tracker")}
            {canReview && link("/marketing-tasks/review", "Review", pendingCount)}
            {canManageUsers && link("/marketing-tasks/admin", "Admin")}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm font-medium text-slate-900">{user.name}</div>
            <div className="text-xs capitalize text-slate-500">{user.role}</div>
          </div>
          <form action="/logout" method="post">
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}

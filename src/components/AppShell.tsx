"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  Inbox,
  LogOut,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type ShellUser = { name: string; email: string; role: string };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AppShell({
  user,
  pendingCount,
  canReview,
  canManageUsers,
  children,
}: {
  user: ShellUser;
  pendingCount: number;
  canReview: boolean;
  canManageUsers: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const nav = [
    { href: "/marketing-tasks", label: "Tracker", icon: ClipboardList, show: true, badge: 0 },
    { href: "/marketing-tasks/review", label: "Review", icon: Inbox, show: canReview, badge: pendingCount },
    { href: "/marketing-tasks/admin", label: "Admin", icon: Settings, show: canManageUsers, badge: 0 },
  ].filter((n) => n.show);

  const isActive = (href: string) =>
    href === "/marketing-tasks" ? pathname === href : pathname.startsWith(href);

  const userMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none ring-ring focus-visible:ring-2">
        <Avatar>
          <AvatarFallback>{initials(user.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="font-medium">{user.name}</div>
          <div className="text-xs font-normal text-muted-foreground">{user.email}</div>
          <div className="mt-1 text-xs font-normal capitalize text-muted-foreground">
            {user.role}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <a href="/logout">
            <LogOut /> Sign out
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card px-4 py-6 md:flex">
        <Link href="/marketing-tasks" className="mb-8 flex items-center gap-2.5 px-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <div className="text-sm font-bold">Trackr</div>
            <div className="text-xs text-muted-foreground">Task Tracker</div>
          </div>
        </Link>

        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(n.href)
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <n.icon className="h-4.5 w-4.5" size={18} />
              <span className="flex-1">{n.label}</span>
              {n.badge > 0 && (
                <Badge className="h-5 min-w-5 justify-center px-1.5">{n.badge}</Badge>
              )}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-between border-t pt-4">
          {userMenu}
          <ThemeToggle />
        </div>
      </aside>

      {/* Mobile top bar + content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-card/90 px-4 py-3 backdrop-blur md:hidden">
          <Link href="/marketing-tasks" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="text-sm font-bold">Trackr</span>
          </Link>
          <nav className="flex items-center gap-1">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "relative rounded-lg px-3 py-1.5 text-sm font-medium",
                  isActive(n.href) ? "bg-primary/10 text-primary" : "text-muted-foreground",
                )}
              >
                {n.label}
                {n.badge > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-destructive" />
                )}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            {userMenu}
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 md:px-8">{children}</main>
      </div>
    </div>
  );
}

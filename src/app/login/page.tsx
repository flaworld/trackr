import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";
import { authenticate, createSession, getCurrentUser } from "@/lib/auth";
import { msAuthEnabled } from "@/lib/oidc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const dynamic = "force-dynamic";

const ERROR_MESSAGES: Record<string, string> = {
  "1": "Invalid email or password.",
  not_provisioned:
    "Your Microsoft account isn't set up for this app yet. Ask an admin to add you.",
  inactive: "Your account is deactivated. Contact an admin.",
  oauth_failed: "Microsoft sign-in failed. Please try again.",
  oauth_state: "Sign-in session expired. Please try again.",
  sso_disabled: "Microsoft sign-in isn't configured.",
  sso_config: "Microsoft sign-in is misconfigured. Contact an admin.",
};

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/marketing-tasks");

  const user = await authenticate(email, password);
  if (!user) {
    redirect(`/login?error=1&next=${encodeURIComponent(next)}`);
  }
  await createSession(user!);
  redirect(next.startsWith("/") ? next : "/marketing-tasks");
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  if (await getCurrentUser()) redirect("/marketing-tasks");
  const ssoEnabled = msAuthEnabled();
  const nextParam = next ?? "/marketing-tasks";
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? "Sign-in failed.") : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/5 via-background to-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
            <Sparkles className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Trackr</h1>
            <p className="text-sm text-muted-foreground">Marketing Task Tracker</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Welcome back</CardTitle>
            <CardDescription>Sign in to continue to your tasks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {errorMessage && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errorMessage}
              </div>
            )}

            {ssoEnabled && (
              <>
                <Button variant="outline" className="w-full" asChild>
                  <a href={`/api/auth/microsoft/login?next=${encodeURIComponent(nextParam)}`}>
                    <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
                      <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                      <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                      <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
                    </svg>
                    Sign in with Microsoft
                  </a>
                </Button>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" />
                  or sign in with email
                  <span className="h-px flex-1 bg-border" />
                </div>
              </>
            )}

            <form action={loginAction} className="space-y-4">
              <input type="hidden" name="next" value={nextParam} />
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@company.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                />
              </div>
              <Button type="submit" className="w-full">
                Sign in
              </Button>
            </form>

            {!ssoEnabled && (
              <div className="rounded-lg bg-muted px-3 py-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Demo accounts</p>
                <p className="mt-1">
                  admin / manager / member / viewer @trackr.test — password{" "}
                  <code>password123</code>
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

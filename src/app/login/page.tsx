import { redirect } from "next/navigation";
import { authenticate, createSession, getCurrentUser } from "@/lib/auth";
import { msAuthEnabled } from "@/lib/oidc";

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
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-slate-900">
            Marketing Task Tracker
          </h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to continue.</p>
        </div>

        {errorMessage && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {ssoEnabled && (
          <>
            <a
              href={`/api/auth/microsoft/login?next=${encodeURIComponent(nextParam)}`}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <svg width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
                <rect x="1" y="1" width="9" height="9" fill="#f25022" />
                <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
                <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
              </svg>
              Sign in with Microsoft
            </a>
            <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200" />
              or
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          </>
        )}

        <form action={loginAction} className="space-y-4">
          <input type="hidden" name="next" value={next ?? "/marketing-tasks"} />
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              defaultValue="admin@trackr.test"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              defaultValue="password123"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            Sign in
          </button>
        </form>

        {!ssoEnabled && (
          <div className="mt-6 rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-500">
            <p className="font-medium text-slate-600">Demo accounts</p>
            <p className="mt-1">
              admin / manager / member / viewer @trackr.test —
              password <code className="text-slate-700">password123</code>
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCodeForClaims, resolveMicrosoftUser } from "@/lib/oidc";
import { createSession } from "@/lib/auth";
import { absoluteUrl } from "@/lib/urls";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function fail(_req: NextRequest, code: string) {
  return NextResponse.redirect(absoluteUrl(`/login?error=${code}`));
}

// GET /api/auth/microsoft/callback — handle the OIDC redirect: validate state,
// exchange the code, verify the id_token, resolve a pre-created user, and issue
// the app session cookie.
export async function GET(req: NextRequest) {
  const jar = await cookies();
  const sp = req.nextUrl.searchParams;

  // Microsoft returned an error (e.g. user cancelled / consent denied).
  if (sp.get("error")) {
    console.warn("[ms-callback] provider error:", sp.get("error"), sp.get("error_description"));
    return fail(req, "oauth_failed");
  }

  const code = sp.get("code");
  const state = sp.get("state");
  const expectedState = jar.get("ms_state")?.value;
  const nonce = jar.get("ms_nonce")?.value;
  const verifier = jar.get("ms_verifier")?.value;
  const next = jar.get("ms_next")?.value ?? "/marketing-tasks";

  // Clear transient cookies regardless of outcome.
  for (const c of ["ms_state", "ms_nonce", "ms_verifier", "ms_next"]) {
    jar.delete(c);
  }

  if (!code || !state || !expectedState || state !== expectedState || !nonce || !verifier) {
    return fail(req, "oauth_state");
  }

  let claims;
  try {
    claims = await exchangeCodeForClaims({
      code,
      codeVerifier: verifier,
      expectedNonce: nonce,
    });
  } catch (e) {
    console.error("[ms-callback] token/verify failed:", e);
    return fail(req, "oauth_failed");
  }

  const result = await resolveMicrosoftUser(claims);
  if (!result.ok) {
    return fail(req, result.reason); // not_provisioned | inactive
  }

  await createSession(result.user);
  return NextResponse.redirect(
    absoluteUrl(next.startsWith("/") ? next : "/marketing-tasks"),
  );
}

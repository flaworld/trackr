import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  msAuthEnabled,
  buildAuthorizationUrl,
  randomToken,
  pkceChallenge,
} from "@/lib/oidc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/auth/microsoft/login — begin the OIDC flow: stash PKCE verifier +
// state + nonce in short-lived httpOnly cookies, then redirect to Microsoft.
export async function GET(req: NextRequest) {
  if (!msAuthEnabled()) {
    return NextResponse.redirect(
      new URL("/login?error=sso_disabled", req.url),
    );
  }

  const state = randomToken(16);
  const nonce = randomToken(16);
  const codeVerifier = randomToken(32);
  const codeChallenge = pkceChallenge(codeVerifier);
  const next = req.nextUrl.searchParams.get("next") ?? "/marketing-tasks";

  let url: string;
  try {
    url = await buildAuthorizationUrl({ state, nonce, codeChallenge });
  } catch (e) {
    console.error("[ms-login] failed to build auth URL:", e);
    return NextResponse.redirect(new URL("/login?error=sso_config", req.url));
  }

  const jar = await cookies();
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 600, // 10 minutes
  };
  jar.set("ms_state", state, opts);
  jar.set("ms_nonce", nonce, opts);
  jar.set("ms_verifier", codeVerifier, opts);
  jar.set("ms_next", next.startsWith("/") ? next : "/marketing-tasks", opts);

  return NextResponse.redirect(url);
}

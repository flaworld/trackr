import { NextRequest, NextResponse } from "next/server";

// Lightweight gate: redirect unauthenticated users (no session cookie) away
// from protected pages. Full JWT verification + authorization happens in
// server components and API route handlers via getCurrentUser/requirePermission.
const COOKIE_NAME = "trackr_session";
const PUBLIC_PATHS = ["/login"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(COOKIE_NAME)?.value);

  // Root -> tracker
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/marketing-tasks", req.url));
  }

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!hasSession && !isPublic) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (hasSession && pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/marketing-tasks", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Protect app pages; exclude API (guarded per-route), static, and assets.
  matcher: ["/", "/marketing-tasks/:path*", "/login"],
};

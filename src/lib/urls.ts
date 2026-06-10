// Absolute-URL helper for redirects issued from route handlers.
//
// Do NOT build absolute redirects from `req.url` in route handlers: behind a
// reverse proxy (Fly, etc.) Next.js reports the server's internal address
// (http://localhost:3000), which would redirect the user's browser to
// localhost. APP_BASE_URL is the single source of truth for our public origin.
export function absoluteUrl(path: string): string {
  const base = (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

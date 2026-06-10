import "server-only";
import crypto from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { prisma } from "./db";
import type { SessionUser } from "./auth";

// Microsoft Entra ID (M365) OpenID Connect — single tenant. Implements the
// Authorization Code flow with PKCE against the standard OIDC endpoints, and
// resolves the signed-in identity to a PRE-CREATED User row (no JIT). The
// session issued afterwards is the same cookie used everywhere else, so the
// role / hierarchy / mailbox access model is unchanged.

export function msAuthEnabled(): boolean {
  return Boolean(
    process.env.MS_TENANT_ID &&
      process.env.MS_CLIENT_ID &&
      process.env.MS_CLIENT_SECRET,
  );
}

function cfg() {
  const tenant = process.env.MS_TENANT_ID!;
  const clientId = process.env.MS_CLIENT_ID!;
  const clientSecret = process.env.MS_CLIENT_SECRET!;
  const base = process.env.APP_BASE_URL ?? "http://localhost:3000";
  const redirectUri = `${base.replace(/\/$/, "")}/api/auth/microsoft/callback`;
  return { tenant, clientId, clientSecret, redirectUri };
}

// --- OIDC discovery (cached per process) ---
type Discovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
};
let discoveryCache: Discovery | null = null;
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

async function discover(): Promise<Discovery> {
  if (discoveryCache) return discoveryCache;
  const { tenant } = cfg();
  const url = `https://login.microsoftonline.com/${tenant}/v2.0/.well-known/openid-configuration`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OIDC discovery failed (${res.status})`);
  discoveryCache = (await res.json()) as Discovery;
  jwks = createRemoteJWKSet(new URL(discoveryCache.jwks_uri));
  return discoveryCache;
}

// --- PKCE / state helpers ---
function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}
export function randomToken(bytes = 32): string {
  return b64url(crypto.randomBytes(bytes));
}
export function pkceChallenge(verifier: string): string {
  return b64url(crypto.createHash("sha256").update(verifier).digest());
}

// Build the Microsoft authorization URL to redirect the browser to.
export async function buildAuthorizationUrl(params: {
  state: string;
  nonce: string;
  codeChallenge: string;
}): Promise<string> {
  const d = await discover();
  const { clientId, redirectUri } = cfg();
  const u = new URL(d.authorization_endpoint);
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("redirect_uri", redirectUri);
  u.searchParams.set("response_mode", "query");
  u.searchParams.set("scope", "openid profile email");
  u.searchParams.set("state", params.state);
  u.searchParams.set("nonce", params.nonce);
  u.searchParams.set("code_challenge", params.codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  return u.toString();
}

// Exchange the authorization code for tokens and return the verified ID-token
// claims. Throws on any verification failure.
export type IdClaims = {
  oid: string;
  email: string | null;
  name: string | null;
};

export async function exchangeCodeForClaims(params: {
  code: string;
  codeVerifier: string;
  expectedNonce: string;
}): Promise<IdClaims> {
  const d = await discover();
  const { clientId, clientSecret, redirectUri } = cfg();

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: redirectUri,
    code_verifier: params.codeVerifier,
    scope: "openid profile email",
  });

  const res = await fetch(d.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Token exchange failed (${res.status}): ${txt.slice(0, 200)}`);
  }
  const tokens = (await res.json()) as { id_token?: string };
  if (!tokens.id_token) throw new Error("No id_token in token response");

  if (!jwks) await discover();
  const { payload } = await jwtVerify(tokens.id_token, jwks!, {
    issuer: d.issuer,
    audience: clientId,
  });

  if (payload.nonce !== params.expectedNonce) {
    throw new Error("Nonce mismatch");
  }

  const oid = String(payload.oid ?? payload.sub ?? "");
  const email =
    (payload.email as string | undefined) ??
    (payload.preferred_username as string | undefined) ??
    (payload.upn as string | undefined) ??
    null;
  const name = (payload.name as string | undefined) ?? null;
  if (!oid) throw new Error("Missing oid/sub in id_token");
  return { oid, email: email ? email.toLowerCase() : null, name };
}

// Resolve the Microsoft identity to a PRE-CREATED, active user (no JIT).
// Match by Entra object id first (stable), then by email; bind the oid on
// first match. Returns a reason code when the user can't sign in.
export type ResolveResult =
  | { ok: true; user: SessionUser }
  | { ok: false; reason: "not_provisioned" | "inactive" };

export async function resolveMicrosoftUser(
  claims: IdClaims,
): Promise<ResolveResult> {
  let user =
    (await prisma.user.findUnique({ where: { entraOid: claims.oid } })) ?? null;

  if (!user && claims.email) {
    user = await prisma.user.findFirst({
      where: { email: { equals: claims.email, mode: "insensitive" } },
    });
  }

  if (!user) return { ok: false, reason: "not_provisioned" };
  if (!user.active) return { ok: false, reason: "inactive" };

  // Bind oid + backfill name on first SSO login.
  if (user.entraOid !== claims.oid) {
    await prisma.user.update({
      where: { id: user.id },
      data: {
        entraOid: claims.oid,
        ...(claims.name && !user.name ? { name: claims.name } : {}),
      },
    });
  }

  return {
    ok: true,
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  };
}

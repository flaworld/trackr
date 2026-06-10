# Deploy — Fly.io + Supabase

The app is a portable container, so this guide targets **Fly.io** (app + worker)
with **Supabase** (managed PostgreSQL). The same image runs on any container host
if you ever move.

## Architecture in production

- **`app` process** — Next.js web server (public HTTPS).
- **`worker` process** — IMAP poller (`node-cron`, every `WORKER_CRON`); polls
  **all active inbound mailboxes**. No public port. (The `/api/cron/poll` endpoint
  still exists as an alternative trigger, but with the persistent worker you don't
  need it.)
- **Supabase** — Postgres. App uses the **pooled** URL; migrations use the
  **direct** URL.

---

## 1. Supabase

1. Create a project at supabase.com. Choose a strong DB password; pick a region
   near your mail server.
2. **Project Settings → Database → Connection string** — grab two:
   - **Transaction pooler** (port `6543`) → this is `DATABASE_URL`. Append
     `?pgbouncer=true&connection_limit=1`.
   - **Direct connection** (port `5432`) → this is `DIRECT_URL`.
   - Both need your DB password and usually `sslmode=require`.

Example:
```
DATABASE_URL=postgresql://postgres.xxxx:PASS@aws-0-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1&sslmode=require
DIRECT_URL=postgresql://postgres.xxxx:PASS@aws-0-REGION.pooler.supabase.com:5432/postgres?sslmode=require
```

---

## 2. Fly.io

Install the CLI (`brew install flyctl`) and `fly auth login`.

```bash
cd "/path/to/Trackr-CMO"
fly launch --no-deploy          # detects Dockerfile + fly.toml; sets app name/region
```
Edit `fly.toml` if needed (the `app` name and `primary_region`).

### Set secrets (never commit these)
```bash
fly secrets set \
  DATABASE_URL="postgresql://...6543...pgbouncer=true&connection_limit=1&sslmode=require" \
  DIRECT_URL="postgresql://...5432...sslmode=require" \
  SESSION_SECRET="$(openssl rand -hex 32)" \
  CRON_SECRET="$(openssl rand -hex 24)" \
  APP_BASE_URL="https://<your-app>.fly.dev" \
  MS_TENANT_ID="..." MS_CLIENT_ID="..." MS_CLIENT_SECRET="..." \
  IMAP_PASSWORD_CMO="..."
```
(Add `IMAP_PASSWORD_OM` etc. as you add mailboxes. `APP_BASE_URL` can be the
`.fly.dev` host now and your custom domain later.)

### Deploy
```bash
fly deploy
```
The release step runs `prisma migrate deploy` automatically (creates all tables).

---

## 3. First-run bootstrap (no demo seed in prod)

Production does **not** run the demo seed. Bootstrap manually:

```bash
# Create the first admin (use your real M365 email):
fly ssh console -C "npm run user:add -- you@fwsom.com admin 'Your Name'"
```

Then:
1. In **Microsoft Entra → App registration → Authentication**, add the redirect
   URI `https://<your-app>.fly.dev/api/auth/microsoft/callback`.
2. Open `https://<your-app>.fly.dev` → **Sign in with Microsoft**.
3. **Admin → Mailboxes**: create `general` (inbound = off) and `cmo`
   (inbound = on, IMAP host/user/folders). Set `IMAP_PASSWORD_CMO` if not already.
   Click **Test connection**.
4. **Admin → Users**: CSV-import staff (with the `manager` column), grant mailbox
   "View all"/"Review" where needed.

---

## 4. Custom domain (optional, later)

```bash
fly certs add trackr.yourdomain.com      # then add the shown DNS records
fly secrets set APP_BASE_URL="https://trackr.yourdomain.com"
```
Add the matching redirect URI in Entra. No code changes.

---

## Health & ops

- **Health check:** `https://<app>.fly.dev/api/health` → `{status:"ok",db:true}`.
- **Logs:** `fly logs` (look for `[worker]` / `[imap:<key>]` lines each cycle).
- **Migrations on every deploy:** handled by `release_command`.
- **Scaling:** `fly scale count app=2` (web) — the worker should stay at 1 to
  avoid double-polling (it has an in-process guard, but one instance is simplest).

## Security notes

- All secrets live in `fly secrets` (and Supabase) — never in the image or git.
- The IMAP password env-var-per-mailbox model means a DB leak exposes no
  credentials.
- Future hardening (see EXPANSION_PLAN.md): a secrets manager and OAuth2/Graph
  mailbox access instead of IMAP basic auth.

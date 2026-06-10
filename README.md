# Marketing Task Tracker

Track marketing tasks with **manual updates** from the web app **and email-based
updates** via IMAP. Forwarded emails are parsed, matched to a task with a
confidence score, and routed to a **review queue** — nothing touches the tracker
until a human approves it (no auto-apply in V1, per spec §17).

Built to the *Custom Build Blueprint* (V1 scope, blueprint §15).

---

## Stack

| Layer | Choice |
|-------|--------|
| Frontend | Next.js 15 (App Router), React 19, Tailwind CSS, TanStack Table |
| Backend | Next.js route handlers, Prisma ORM |
| Database | **PostgreSQL** (local dev via Docker; any Postgres in prod) |
| Auth | Cookie session (`jose` JWT); email/password (`bcryptjs`) **+ Microsoft 365 SSO**; 4 roles |
| Email worker | Standalone Node process: `imapflow` + `mailparser`, scheduled with `node-cron` |

---

## Quick start

Requires Docker (for the local Postgres) and Node 20+.

```bash
npm install                 # installs deps + generates Prisma client
cp .env.example .env        # then edit .env (the defaults work for local Docker)
docker compose up -d        # start local PostgreSQL (user/pass/db = trackr, port 5432)
npm run db:migrate          # create the schema
npm run db:seed             # seed 4 demo users + 6 sample tasks
npm run dev                 # http://localhost:3000
```

> No Docker? Point `DATABASE_URL` in `.env` at any reachable Postgres instead.

Open <http://localhost:3000> → you'll be redirected to **/login**.

### Demo accounts (password `password123`)

| Email | Role | Sees |
|-------|------|------|
| admin@trackr.test | admin | Everything |
| manager@trackr.test | manager | Own + reports' tasks (member, member2); approves for them |
| cmo@trackr.test | manager | **CMO Tracker** — all tasks sourced from `tracker-cmo@`; reviews CMO mail |
| member@trackr.test | member | Own tasks only; add notes |
| member2@trackr.test | member | Own tasks only |
| viewer@trackr.test | viewer | Read-only, own only |

Visibility is driven by **assignment + reporting hierarchy + mailbox grants**
(see `src/lib/access.ts` and `docs/EXPANSION_PLAN.md`). Use the **view switcher**
(My Tasks / My Team / CMO Tracker / All) on the tracker to change scope.

---

## Trying the email → review → approve flow **without** a live mailbox

The full ingest pipeline (parse → extract → match → suggest) is decoupled from
IMAP, so you can demo it instantly:

```bash
npm run seed-email          # injects 4 sample emails (1 exact code match, 1
                            # owner-match, 1 high-confidence name match, 1 spam)
# or inject a custom one:
npm run seed-email -- "TASK-104 is now completed, published this morning"
```

Then sign in as **admin** or **manager** and open **Review** in the top nav.
Approve a suggestion and watch the tracker row + its history update.

---

## Connecting a real IMAP mailbox

Fill the `IMAP_*` vars in `.env` (e.g. a dedicated `marketing-updates@…`
mailbox), then:

```bash
npm run worker              # polls every WORKER_CRON (default: every 3 min)
npm run worker:once         # single pass, then exit (useful for cron/testing)
```

The worker:
- fetches **unseen** messages, parses them, runs the same ingest pipeline;
- is **idempotent** on `Message-ID` (re-runs skip already-seen mail);
- **never deletes** mail — it flags handled messages `\Seen` and, if
  `EMAIL_MOVE_PROCESSED=true`, moves them to `EMAIL_PROCESSED_FOLDER`;
- logs failures (and can move them to `EMAIL_FAILED_FOLDER`).

> Gmail: use `imap.gmail.com:993`, `IMAP_SECURE=true`, and an **App Password**
> (not your account password). Enable IMAP in Gmail settings.

Run the worker in a **separate terminal** from `npm run dev`. Both connect to
the same PostgreSQL database.

### Multiple mailboxes

The worker polls **every active inbound mailbox** (the `Mailbox` rows), each with
its own IMAP config. Connection details (host/user/folders/TLS) are managed in
the app at **`/marketing-tasks/admin/mailboxes`**; the password for each lives in
an env var named **`IMAP_PASSWORD_<KEY>`** (e.g. `IMAP_PASSWORD_CMO`,
`IMAP_PASSWORD_OM`) — secrets never sit in the database.

To add a mailbox (e.g. `tracker-om@`): create it in the Mailboxes admin tab →
set `IMAP_PASSWORD_OM` in the environment → click **Test connection** → done.
Emails are matched only against tasks from the **same** mailbox.

There are **three ways** to drive polling — pick the one that fits where you run:

| Mode | Command / setup | Best for |
|------|-----------------|----------|
| Continuous | `npm run worker` (polls all mailboxes on `WORKER_CRON`) | a long-lived box / local dev |
| One-shot | `npm run worker:once` (one pass, exits) | system/cron-driven scheduling |
| HTTP trigger | `GET/POST /api/cron/poll` (secured; `?mailbox=<key>` for one) | hosted/cPanel/serverless — **no terminal** |

---

## Deployment

**Primary target: Fly.io (app + worker container) + Supabase (Postgres).** Full
step-by-step in [`docs/DEPLOY.md`](docs/DEPLOY.md) — the app is containerized
(`Dockerfile` + `fly.toml`), so the same image is portable to Cloud Run / Render
/ etc. without a rewrite. Database migrations run automatically on each deploy.

<details>
<summary>Alternative: cPanel / Plesk (cron-triggered polling)</summary>

## Deploying to cPanel / Plesk + scheduled polling

On managed hosting you run the **web app** as a Node app and let a **cron job**
trigger polling over HTTPS — no background process or terminal required.
Provision a PostgreSQL database first (cPanel → *PostgreSQL Databases*) and set
`DATABASE_URL` to it.

> ⚠️ cPanel must support **"Setup Node.js App"** (CloudLinux + Passenger) to run
> Next.js. If your plan is PHP-only, host the app on a small VPS instead and
> point it at the same mailbox + Postgres. The app code is identical either way.

**1. Deploy the app** (cPanel → *Setup Node.js App*):
- Application root: your uploaded project folder.
- Startup file: cPanel/Passenger runs `npm start`; build first with `npm run build`
  (run `npm install` and `npm run build` from the app's terminal, then restart).
- Application URL: your subdomain (e.g. `trackr.fwsom.com`).
- Add all the `.env` values (DATABASE_URL, SESSION_SECRET, IMAP_*, CRON_SECRET,
  EMAIL_* ) in the app's **Environment variables** section.
- Run the migration + seed once from the app's terminal:
  `npm run db:migrate && npm run db:seed` (or `prisma migrate deploy`).

**2. Set `CRON_SECRET`** to a long random value (same value in the app env).

**3. Add the cron job** (cPanel → *Cron Jobs*), every 3 minutes:

```bash
*/3 * * * * curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" https://trackr.fwsom.com/api/cron/poll >/dev/null 2>&1
```

That's it — every 3 minutes the running app polls the mailbox and populates the
review queue. The endpoint:
- requires the secret (Bearer header **or** `?key=…` for simple schedulers);
- returns JSON poll stats: `{ ok, fetched, ingested, skipped, failed }`;
- has a built-in **concurrency guard** so overlapping ticks never double-poll.

> Alternative (a real SSH server instead of an HTTP trigger): a system crontab
> line running `cd /path/to/app && npm run worker:once` works identically.

</details>

---

## Microsoft 365 sign-in (Entra ID SSO)

Users can sign in with their Microsoft account. Sign-in is **restricted to
pre-created users** — an admin must add the person (matched by email) before
they can log in; there is no auto-signup. The existing email/password login
remains as an admin fallback. Leaving the `MS_*` env vars blank hides the
button entirely.

### One-time Azure setup

1. **Azure portal → Microsoft Entra ID → App registrations → New registration.**
   - Name: e.g. "Marketing Task Tracker".
   - Supported account types: **Single tenant** (this org only).
   - Redirect URI: **Web** → `https://trackr.fwsom.com/api/auth/microsoft/callback`
     (for local dev also add `http://localhost:3000/api/auth/microsoft/callback`).
2. Copy the **Application (client) ID** and **Directory (tenant) ID** from Overview.
3. **Certificates & secrets → New client secret** → copy the **Value** (shown once).
4. **API permissions** → the default `User.Read` (delegated) is enough; the app
   only reads basic profile (`openid profile email`).
5. Put the three values in the environment:
   ```bash
   MS_TENANT_ID="<directory (tenant) id>"
   MS_CLIENT_ID="<application (client) id>"
   MS_CLIENT_SECRET="<client secret value>"
   ```
   Ensure `APP_BASE_URL` matches the host in the redirect URI.

### Adding users

Admins manage users in-app at **`/marketing-tasks/admin`** (the **Admin** nav
link, admin-only):
- **Add / edit users** — email, name, role, manager, and per-mailbox grants
  ("View all" = sees the whole stream e.g. CMO Tracker; "Review" = approve that
  mailbox's email suggestions). Optionally set a fallback password; otherwise the
  user is Microsoft-only.
- **Deactivate / reactivate** (you can't lock out your own admin account).
- **Import CSV** — bulk create/update. Header row required; columns:
  `email` (required), `name`, `role`, `manager` (manager's email). Managers are
  linked in a second pass, so order doesn't matter.

Or from the CLI (handy for the first admin / scripts):
```bash
npm run user:add -- jane@fwsom.com admin "Jane Doe"
npm run user:add -- bob@fwsom.com member "Bob Lee" jane@fwsom.com   # last arg = manager email
```

On first Microsoft login the app binds the user's Entra object id to their
account (matched by email).

The flow uses the Authorization Code grant with **PKCE**, validates the
`id_token` signature/issuer/audience/nonce, and then issues the same session
cookie used by password login — so roles, hierarchy, and mailbox access all
apply unchanged. Implementation: `src/lib/oidc.ts` +
`src/app/api/auth/microsoft/*`.

---

## How matching works (blueprint §7–§8)

`src/lib/extract.ts` pulls a possible task code (`TASK-104` / `[TASK-104]`),
status (keyword map), due date (ISO / "July 15" / "in 3 days" / "end of week"),
and a short summary out of the email.

`src/lib/match.ts` scores each candidate task 0–100:

| Signal | Score |
|--------|-------|
| Exact task code | 95–100 |
| Task name verbatim in subject/body | 85–95 |
| Close text similarity (token Dice) | 65–85 |
| Sender is owner + update keywords | 50–70 |
| Otherwise | < 50 (unmatched) |

The review queue bands these as **High confidence** (≥80), **Needs review**
(50–79), and **Unmatched** (<50). An unmatched email can be linked to a task or
turned into a new task before approval.

---

## Database

The app runs on **PostgreSQL** everywhere.

- **Local dev:** `docker compose up -d` starts a `postgres:16` container
  (credentials/db all `trackr`, port 5432) with a persistent named volume. Stop
  with `docker compose down` (add `-v` to wipe the data).
- **Production:** point `DATABASE_URL` at any Postgres — cPanel *PostgreSQL
  Databases*, a VPS-local Postgres, or a managed provider (add
  `?sslmode=require` if it needs TLS). Then run `prisma migrate deploy` once.

Enum-like fields are stored as strings with the valid values centralised in
`src/lib/constants.ts`, so there are no DB-specific enum types to manage.

### Resetting local data

```bash
npm run db:reset      # drop, re-migrate, and re-seed (DESTROYS local data)
```

---

## Project layout

```
prisma/schema.prisma         6 tables (users, tasks, email_updates,
prisma/seed.ts                 task_update_suggestions, task_history,
                               email_attachments) + enums-as-constants
src/lib/
  constants.ts               enum values + role→permission matrix
  auth.ts                    session, hashing, requireUser/requirePermission
  extract.ts                 email field extraction (§7)
  match.ts                   confidence scoring (§8)
  ingest.ts                  parse→extract→match→suggestion pipeline (§6/§13)
  imap.ts                    IMAP connect + pollInbox (shared by worker + cron)
  tasks.ts                   task CRUD + history writes
  review.ts                  transactional approve/reject/link (§14)
src/app/
  login, logout              auth
  marketing-tasks/           tracker page (§10)
  marketing-tasks/review/    review queue (§9)
  api/tasks/*                task APIs (§5)
  api/email-updates/*        review APIs (§5)
  api/cron/poll              secured HTTP cron trigger (hosted polling)
worker/imap-worker.ts        IMAP polling worker (§13)
worker/seed-email.ts         local test-email injector (no IMAP needed)
```

---

## Scripts

| Command | What |
|---------|------|
| `docker compose up -d` / `down` | Start / stop local PostgreSQL |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run worker` / `worker:once` | IMAP polling worker (continuous / one pass) |
| `npm run imap:test` | Read-only IMAP connection diagnostic |
| `npm run seed-email` | Inject test emails into the pipeline |
| `npm run user:add -- <email> [role] ["Name"] [managerEmail]` | Provision/update a user (CLI) |
| `npm run db:migrate` / `db:seed` / `db:reset` / `db:studio` | Prisma |

---

## V1 scope & what's intentionally out

**In (blueprint §15):** login-protected tracker, manual task CRUD, IMAP worker,
email parsing, review queue, approve/reject, task history, attachment capture,
filters & search.

**Out (blueprint §16, V2):** auto-apply/AI matching, summarization,
Slack/Teams, digests, comments, SLA, calendar, webhooks. Auto-approval is
deliberately **not** built — every email-sourced change requires human approval.

---

## Roadmap

A V2 expansion is designed (not yet built): move to **PostgreSQL** and grow from a
single-mailbox tracker into a multi-mailbox system for 40+ staff, with
**reporting-hierarchy visibility** (managers see their reports' tasks),
**multiple source mailboxes** (`tracker-cmo@`, `tracker-om@`, …), and
**mailbox-scoped views** (e.g. a "CMO Tracker" showing all `tracker-cmo@` tasks).

Full architecture, data-model changes, and build sequence:
[`docs/EXPANSION_PLAN.md`](docs/EXPANSION_PLAN.md).

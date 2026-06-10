# Expansion Plan — Multi-Mailbox + Hierarchy Visibility (V2)

**Status:** Phase 1 BUILT (Postgres + schema + access control + mailbox-scoped
ingestion + view switcher). Remaining: multi-mailbox polling for a 2nd mailbox,
user management for 40+, and richer org/admin UI (see build sequence below).

## Goal

Evolve from a single-mailbox tracker for a small selected group into a system for
**one shared pool of 40+ staff**, fed by **multiple mailboxes** (`tracker-cmo@`,
`tracker-om@`, …), with visibility driven by **assignment + reporting hierarchy +
source mailbox**, running on **PostgreSQL**.

## Confirmed requirements

- Same people across CMO and OM — not separate populations.
- Mailboxes are **task sources/streams**, not people-groups.
- Visibility:
  - **Member** → tasks assigned to themselves.
  - **Manager** → own tasks **+ all reports' tasks** (direct *and* indirect, via a
    reporting chain where each person has a manager).
  - **CMO (a supervisor)** → a **"CMO Tracker" view = ALL tasks sourced from
    `tracker-cmo@`**, regardless of assignee.
  - **Admin** → everything.
- Build the design now; implement as a later phase.

---

## Why PostgreSQL (decision)

Not about data volume (40+ users is tiny). The drivers are **shape + concurrency**:
- Reporting hierarchy + team-based row-level visibility = richer relational queries
  (recursive "who reports to me").
- 40+ concurrent users **plus** multiple mailbox pollers writing → real concurrent
  writes (SQLite serializes writers).
- Operational durability (backups / PITR) for something many people depend on.

Migrate **before** the data + user base grow; the schema was built to port (string
enums, no SQLite-specific features). cPanel → *PostgreSQL Databases* (point-and-click)
→ set `DATABASE_URL` → change `provider` in `schema.prisma` → `prisma migrate`.

---

## Data model changes

### `users` (extend)
- `managerId String?` — self-FK; the person this user reports to. Nullable (top of
  chain). Drives manager/supervisor visibility (transitive).
- Roles unchanged (`admin | manager | member | viewer`); add `supervisor` if useful.
  **Visibility is hierarchy-driven, not role-driven** — a member simply has no
  reports. Role still governs *actions* (create / approve / manage users).

### `mailboxes` (new)
One row per ingest mailbox.
- `id`, `key` (e.g. `"cmo"`, `"om"`), `address` (`tracker-cmo@fwsom.com`),
  `displayName`, `active`.
- Non-secret IMAP config: `imapHost`, `imapPort`, `imapSecure`, `imapUser`,
  `allowSelfSigned`, `processedFolder`, `failedFolder`, `moveProcessed`.
- **Secret handling:** do NOT store passwords in the DB. Look the password up from a
  per-mailbox env var by convention, e.g. `IMAP_PASSWORD_CMO`, `IMAP_PASSWORD_OM`
  (env var name derived from `key`). Keeps secrets out of the database.

### `mailbox_access` (new)
Grants a user the **full stream** of a mailbox (this is how the "CMO Tracker" works,
and it generalises to "OM head sees all OM tasks" later).
- `userId`, `mailboxId`, `canViewAll Boolean`, `canReview Boolean`.
- The CMO gets `mailbox_access(cmo, canViewAll=true, canReview=true)`.

### `tasks` (extend)
- `mailboxId String?` — the **source mailbox**. Email-created tasks inherit the
  email's mailbox; manual tasks get a mailbox chosen by the creator (or a default).

### `email_updates` (extend)
- `mailboxId String` — which mailbox this email arrived in. Suggestions inherit it
  through their email.

### Reporting hierarchy
- Modelled purely via `users.managerId` (no separate teams table — matches the
  "each person has a manager" decision).
- "My team" = transitive closure of `managerId == me`. In Postgres, compute with a
  **recursive CTE**; at 40 users an app-side walk is also fine.

---

## Access-control layer (row-level)

Single source of truth: a `visibleTaskWhere(user)` helper returning a Prisma filter.

```
admin                -> {}                              // everything
otherwise            -> OR [
  { ownerId: user.id },                                 // own tasks
  { ownerId: { in: await reportIds(user.id) } },        // transitive reports
  { mailboxId: { in: mailboxViewAllIds(user.id) } },    // mailbox grants (CMO)
]
```

Apply this filter to **every** task-reading path:
- `listTasks` (tracker), task detail, `/history`, `/email-updates`.
- **Review queue**: a suggestion is visible/approvable if its task is visible to the
  user OR the user has `canReview` on the email's mailbox. (CMO reviews CMO mail;
  OM managers review OM mail; admin all.)

Action permissions (extend current matrix):
- `task:editAssigned` extends to **own + reports** (a manager can edit reports' tasks).
- `review:approve` becomes **mailbox-scoped** via `mailbox_access.canReview` (+ admin).

### Saved views (app-level, gated by access)
- **My Tasks** — `ownerId == me` (everyone, default).
- **My Team** — `ownerId in reports(me)` (anyone with reports).
- **CMO Tracker** — `mailboxId == cmo` (users with `canViewAll` on cmo; + admin).
- **All** — admin only.

---

## Multi-mailbox ingestion

- Worker / `/api/cron/poll` iterate **all active mailboxes**, connecting with each
  mailbox's own config (+ password from its env var), stamping
  `email_updates.mailboxId` and any created task's `mailboxId`.
- Optional `/api/cron/poll?mailbox=cmo` to poll one mailbox (lets you stagger cron
  jobs per mailbox if desired).
- **Mailbox-scoped matching (important for precision at scale):** when matching an
  email, restrict candidate tasks to the **same mailbox** — an email to `tracker-cmo@`
  matches CMO tasks only, not OM tasks. Update `loadCandidates()` to take a `mailboxId`.

---

## User management for 40+

The current seeded-users + shared-password setup does not scale. Add:
- **Admin user management UI**: create/edit users, set role + manager, deactivate.
- **CSV import** of the 40 people with a `manager email` column to wire the hierarchy
  in one pass.
- **Password reset / invite flow** via SMTP (fwsom.com already sends mail). Interim
  option: admin sets a temporary password the user changes on first login.

---

## UI changes

- **Source mailbox** column + filter on the tracker; a **view switcher**
  (My Tasks / My Team / CMO Tracker / All) reflecting the user's access.
- **Org / users** admin pages (list, edit, manager assignment, CSV import).
- Review queue: mailbox filter + scoping; show which mailbox each suggestion came from.

---

## Suggested build sequence

1. ✅ **Postgres switch** — provider + `DATABASE_URL`; baseline migration.
2. ✅ **Schema additions** — `mailboxes`, `mailbox_access`, `users.managerId`,
   `tasks.mailboxId`, `email_updates.mailboxId`; seed `general` + `cmo`.
3. ✅ **Access-control layer** — `src/lib/access.ts` (`visibleTaskWhere`,
   `reportIds`, `canViewTask`, `canEditTask`, `canReviewSuggestion`); applied to
   every task/review endpoint; managers edit/approve own + reports; CMO grant
   sees/reviews the whole `cmo` stream.
4. ✅ **Mailbox-scoped matching + ingestion stamping** — `loadCandidates(mailboxId)`;
   emails + email-created tasks stamped with their mailbox; manual tasks → `general`.
5. ✅ **Views + UI (partial)** — view switcher (My Tasks / My Team / <Mailbox>
   Tracker / All), source-mailbox column + filter, review-queue mailbox scoping.

6. ✅ **Microsoft 365 SSO** — OIDC + PKCE, pre-created users, password fallback
   (`src/lib/oidc.ts`, `/api/auth/microsoft/*`).
7. ✅ **User management** — admin console at `/marketing-tasks/admin`
   (create/edit/deactivate, role + manager + mailbox grants), CSV import with
   2-pass manager resolution, and a `npm run user:add` CLI.

8. ✅ **Multi-mailbox polling** — worker / `/api/cron/poll` iterate ALL active
   inbound mailboxes, each with its own DB config + per-mailbox secret
   (`IMAP_PASSWORD_<KEY>`, env-only). `?mailbox=<key>` polls one. Mailbox-scoped
   matching already restricts candidates to the same mailbox.
9. ✅ **Mailbox admin UI** — `/marketing-tasks/admin/mailboxes`: create/edit
   mailboxes + IMAP config, with a read-only **Test connection** check and a
   password-set indicator.

**To bring `tracker-om@` online:** add the mailbox in the admin UI → set
`IMAP_PASSWORD_OM` → Test connection → CSV-import the OM staff. No code changes.

**Possible later work:** OAuth2/Microsoft Graph mailbox access (Microsoft is
deprecating basic-auth IMAP); secrets manager (e.g. Azure Key Vault) injecting
the `IMAP_PASSWORD_*` vars; outbound notifications (digests, Slack/Teams).

Each step is independently shippable; the system keeps working between steps.

---

## Open questions to resolve before building

- Default mailbox for **manually-created** tasks (force a choice, or a "General"
  default?).
- Should a manager be able to **approve** email suggestions for their reports'
  tasks, or is approval purely mailbox-grant + admin?
- Outbound email path for password reset (SMTP creds on `fwsom.com`).
- Do viewers/members need to see the **source mailbox** of their own tasks, or hide it?

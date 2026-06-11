# Trackr — Team Guide

**URL: https://trackr.fwsom.com**

Trackr is our task tracker for marketing and operations work. It keeps every
task, owner, status, and deadline in one place — and it can update itself from
the emails you already send.

---

## Signing in

1. Go to **https://trackr.fwsom.com**
2. Click **Sign in with Microsoft**
3. Use your normal company Microsoft 365 account — no new password to remember.

Your account is already set up. If sign-in says your account isn't provisioned,
contact the admin.

---

## What you'll see

- **My Tasks** — every task assigned to you: status, priority, due date, and
  the latest notes.
- **My Team** (managers) — your tasks plus everything assigned to the people
  who report to you.
- **CMO Tracker** (supervisors with access) — every task that came in through
  the CMO mailbox, regardless of who owns it.
- **Review** (managers/approvers) — email updates waiting for approval (see
  "How email updates work" below).

Use the search box and filters (status, owner, source, priority, overdue) to
narrow any view. Click the **history icon** on a task to see its full audit
trail — every change, who made it, and when. The moon/sun button switches
light/dark mode.

---

## Two ways to update a task

### 1. In the app

Open your task → **pencil icon** → change status, due date, or add a note →
Save. Managers can edit their team members' tasks the same way.

### 2. By email (the magic part ✉️)

Forward or send any task-related email to the tracker mailbox:

- **tracker-cmo@fwsom.com** — for CMO-stream work
- **tracker-om@fwsom.com** — for OM-stream work

Trackr reads the email, figures out which task it's about, extracts the new
status and due date, and queues a **suggested update**. Nothing changes on the
tracker until a manager approves it — so a misread email can never corrupt the
data.

**Make your email easy to match — include the task code:**

> **Subject:** Update on [TASK-104] retargeting campaign
> **Body:** Ad account is approved, we're working on it now. Target launch July 15.

- The task code (e.g. `TASK-104`) appears on every task in the tracker. With
  the code, matching is essentially perfect; without it Trackr matches by task
  name and sender, which may need manual review.
- Plain phrases work for status: *"done", "completed", "working on it",
  "blocked", "waiting for approval"*…
- Dates work in plain English too: *"due July 15"*, *"by end of week"*,
  *"in 3 days"*.

---

## The process flow

```
You send/forward an email to tracker-cmo@ or tracker-om@
        │
        ▼  (within ~3 minutes)
Trackr reads it, finds the matching task,
extracts status / due date / summary
        │
        ▼
Suggested update appears in the Review queue
with a confidence score
        │
        ▼
A manager approves, rejects, or re-links it
        │
        ▼  (on approval)
The task updates on the tracker, and the change
is recorded in the task's history — with a link
back to the original email
```

Your original email is never deleted — it's filed in the tracker mailbox's
Processed folder, and the task's history links back to it.

---

## For managers & approvers

The **Review** queue shows email suggestions you're allowed to act on (your
team's tasks, or mailboxes you have review access to). Each card shows the
suggested change side-by-side with the original email:

- **Approve & apply** — the task is updated instantly, history recorded.
- **Reject** — nothing changes; the email stays archived.
- **Link / create task** — if Trackr matched the wrong task (or none), point
  the email at the right one or spin up a new task from it.

Confidence guide: **High confidence (80%+)** usually means an exact task-code
match — quick to approve. **Needs review** deserves a closer look.
**Unmatched** needs you to link or create the task.

---

## Who can do what

| Role | Can do |
|------|--------|
| Member | See & update their own tasks, add notes, email updates in |
| Manager | All of the above for their whole team + approve email updates |
| Supervisor (mailbox access) | See & review everything in that mailbox's stream |
| Admin | Everything, including user & mailbox management |

---

## Quick tips

1. **Always include the task code** (`TASK-###`) in email subjects when you
   know it — it makes matching instant.
2. One topic per email — a forwarded thread about one task matches better than
   a digest of five.
3. Check **My Tasks** for anything **Overdue** (highlighted in red) at the
   start of your day.
4. Managers: clear your **Review** queue daily — the badge in the sidebar
   shows how many are waiting.

Questions or access issues → contact the admin.

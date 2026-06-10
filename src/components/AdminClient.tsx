"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ROLES } from "@/lib/constants";
import { Modal } from "./Modal";
import type { AdminUser, MailboxAdmin } from "@/lib/types";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

export function AdminClient({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [mailboxes, setMailboxes] = useState<MailboxAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<AdminUser | "new" | null>(null);
  const [importing, setImporting] = useState(false);
  const [showInactive, setShowInactive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [u, m] = await Promise.all([
        fetch("/api/admin/users", { cache: "no-store" }),
        fetch("/api/admin/mailboxes", { cache: "no-store" }),
      ]);
      if (!u.ok) throw new Error((await u.json()).error ?? "Failed to load users");
      setUsers((await u.json()).users);
      setMailboxes((await m.json()).mailboxes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const shown = useMemo(
    () => (showInactive ? users : users.filter((u) => u.active)),
    [users, showInactive],
  );

  const toggleActive = async (u: AdminUser) => {
    if (u.id === currentUserId) return;
    await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !u.active }),
    });
    load();
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Users &amp; Access</h1>
          <p className="text-sm text-slate-500">
            {loading ? "Loading…" : `${users.length} users`}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setImporting(true)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Import CSV
          </button>
          <button
            onClick={() => setEdit("new")}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            + Add User
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <label className="mb-3 flex items-center gap-1.5 text-sm text-slate-600">
        <input
          type="checkbox"
          checked={showInactive}
          onChange={(e) => setShowInactive(e.target.checked)}
        />
        Show deactivated
      </label>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["Name", "Email", "Role", "Manager", "Sign-in", "Access", "Status", ""].map(
                (h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((u) => (
              <tr key={u.id} className={u.active ? "" : "bg-slate-50/60 text-slate-400"}>
                <td className="px-3 py-2.5 font-medium text-slate-900">
                  {u.name}
                  {u.id === currentUserId && (
                    <span className="ml-1 text-xs font-normal text-slate-400">(you)</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-slate-600">{u.email}</td>
                <td className="px-3 py-2.5">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize text-slate-700">
                    {u.role}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-slate-600">{u.manager?.name ?? "—"}</td>
                <td className="px-3 py-2.5 text-xs text-slate-500">
                  {u.authMethods.length ? u.authMethods.join(", ") : "—"}
                </td>
                <td className="px-3 py-2.5 text-xs text-slate-500">
                  {u.mailboxAccess.length
                    ? u.mailboxAccess
                        .map(
                          (g) =>
                            `${g.mailbox.displayName}${g.canViewAll ? "·view" : ""}${g.canReview ? "·review" : ""}`,
                        )
                        .join(", ")
                    : "—"}
                </td>
                <td className="px-3 py-2.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.active
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {u.active ? "active" : "deactivated"}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right whitespace-nowrap">
                  <button
                    onClick={() => setEdit(u)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                  >
                    Edit
                  </button>
                  {u.id !== currentUserId && (
                    <button
                      onClick={() => toggleActive(u)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100"
                    >
                      {u.active ? "Deactivate" : "Reactivate"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!loading && shown.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-slate-400">
                  No users.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {edit && (
        <UserForm
          user={edit === "new" ? null : edit}
          users={users}
          mailboxes={mailboxes}
          isSelf={edit !== "new" && edit.id === currentUserId}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            load();
          }}
        />
      )}
      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onDone={() => {
            setImporting(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function UserForm({
  user,
  users,
  mailboxes,
  isSelf,
  onClose,
  onSaved,
}: {
  user: AdminUser | null;
  users: AdminUser[];
  mailboxes: MailboxAdmin[];
  isSelf: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !user;
  const [email, setEmail] = useState(user?.email ?? "");
  const [name, setName] = useState(user?.name ?? "");
  const [role, setRole] = useState(user?.role ?? "member");
  const [managerId, setManagerId] = useState(user?.managerId ?? "");
  const [password, setPassword] = useState("");
  const [setPw, setSetPw] = useState(false);
  const [grants, setGrants] = useState<
    Record<string, { canViewAll: boolean; canReview: boolean }>
  >(() => {
    const g: Record<string, { canViewAll: boolean; canReview: boolean }> = {};
    user?.mailboxAccess.forEach((a) => {
      g[a.mailboxId] = { canViewAll: a.canViewAll, canReview: a.canReview };
    });
    return g;
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const setGrant = (id: string, k: "canViewAll" | "canReview", v: boolean) =>
    setGrants((prev) => {
      const cur = prev[id] ?? { canViewAll: false, canReview: false };
      return { ...prev, [id]: { ...cur, [k]: v } };
    });

  const submit = async () => {
    setSaving(true);
    setErr(null);
    const grantsArr = mailboxes.map((m) => ({
      mailboxId: m.id,
      canViewAll: grants[m.id]?.canViewAll ?? false,
      canReview: grants[m.id]?.canReview ?? false,
    }));
    try {
      const res = await fetch(
        isNew ? "/api/admin/users" : `/api/admin/users/${user!.id}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(isNew ? { email } : {}),
            name,
            role,
            managerId: managerId || null,
            grants: grantsArr,
            ...(setPw ? { password } : {}),
          }),
        },
      );
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const managerOptions = users.filter((u) => u.id !== user?.id && u.active);

  return (
    <Modal open onClose={onClose} title={isNew ? "Add User" : `Edit ${user!.name}`} wide>
      {err && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      <div className="grid grid-cols-2 gap-3">
        <label className="col-span-2 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Email (M365)</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={!isNew}
            className={`${inputCls} ${!isNew ? "bg-slate-100 text-slate-500" : ""}`}
            placeholder="person@fwsom.com"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Role</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={isSelf}
            className={`${inputCls} ${isSelf ? "bg-slate-100" : ""}`}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {isSelf && <span className="text-xs text-slate-400">Can't change your own role</span>}
        </label>
        <label className="col-span-2 block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Manager</span>
          <select
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
            className={inputCls}
          >
            <option value="">— none —</option>
            {managerOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} ({u.email})
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Mailbox grants */}
      <div className="mt-4">
        <p className="mb-2 text-sm font-medium text-slate-700">Mailbox access</p>
        <div className="space-y-1.5 rounded-lg border border-slate-200 p-3">
          {mailboxes.map((m) => (
            <div key={m.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-700">
                {m.displayName}
                <span className="ml-1 text-xs text-slate-400">{m.inbound ? "(inbound)" : ""}</span>
              </span>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={grants[m.id]?.canViewAll ?? false}
                    onChange={(e) => setGrant(m.id, "canViewAll", e.target.checked)}
                  />
                  View all
                </label>
                <label className="flex items-center gap-1.5 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={grants[m.id]?.canReview ?? false}
                    onChange={(e) => setGrant(m.id, "canReview", e.target.checked)}
                  />
                  Review
                </label>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-400">
          “View all” = sees the whole mailbox stream (e.g. CMO Tracker). “Review” = can
          approve that mailbox's email suggestions.
        </p>
      </div>

      {/* Optional password */}
      <div className="mt-4">
        <label className="flex items-center gap-1.5 text-sm text-slate-700">
          <input type="checkbox" checked={setPw} onChange={(e) => setSetPw(e.target.checked)} />
          Set a password (fallback login){user?.hasPassword ? " — replaces existing" : ""}
        </label>
        {setPw && (
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="min 8 characters (leave blank to clear)"
            className={`${inputCls} mt-2`}
          />
        )}
        {!setPw && (
          <p className="mt-1 text-xs text-slate-400">
            Leave unchecked for Microsoft-only sign-in.
          </p>
        )}
      </div>

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={saving || (isNew && !email.trim())}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [csv, setCsv] = useState("email,name,role,manager\n");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    updated: number;
    errors: { email: string; message: string }[];
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/users/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Import failed");
      setResult(await res.json());
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open onClose={onClose} title="Import users from CSV" wide>
      {err && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      <p className="mb-2 text-sm text-slate-600">
        Header row required. Columns: <code className="text-slate-800">email</code> (required),{" "}
        <code className="text-slate-800">name</code>, <code className="text-slate-800">role</code>{" "}
        (admin/manager/member/viewer), <code className="text-slate-800">manager</code> (manager's
        email). Existing users are updated; managers are linked after all rows are created.
      </p>
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={10}
        spellCheck={false}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs focus:border-brand-500 focus:outline-none"
        placeholder={"email,name,role,manager\njane@fwsom.com,Jane Doe,manager,\nbob@fwsom.com,Bob Lee,member,jane@fwsom.com"}
      />

      {result && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
          <p className="font-medium text-slate-700">
            Created {result.created} · Updated {result.updated} · Errors{" "}
            {result.errors.length}
          </p>
          {result.errors.length > 0 && (
            <ul className="mt-2 max-h-40 space-y-0.5 overflow-y-auto text-xs text-red-600">
              {result.errors.map((e, i) => (
                <li key={i}>
                  {e.email}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={result ? onDone : onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          {result ? "Done" : "Cancel"}
        </button>
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "Importing…" : "Import"}
        </button>
      </div>
    </Modal>
  );
}

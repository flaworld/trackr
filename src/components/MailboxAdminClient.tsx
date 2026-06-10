"use client";
import { useCallback, useEffect, useState } from "react";
import { Modal } from "./Modal";
import type { MailboxAdminRow } from "@/lib/types";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

type TestState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "ok"; folders: string[]; inboxTotal: number; inboxUnseen: number }
  | { status: "error"; error: string };

export function MailboxAdminClient() {
  const [mailboxes, setMailboxes] = useState<MailboxAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<MailboxAdminRow | "new" | null>(null);
  const [tests, setTests] = useState<Record<string, TestState>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/mailboxes", { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setMailboxes((await res.json()).mailboxes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (m: MailboxAdminRow) => {
    if (!window.confirm(`Delete mailbox "${m.displayName}" (${m.key})? This cannot be undone.`)) {
      return;
    }
    setError(null);
    const res = await fetch(`/api/admin/mailboxes/${m.id}`, { method: "DELETE" });
    if (!res.ok) {
      setError((await res.json()).error ?? "Delete failed");
      return;
    }
    load();
  };

  const test = async (m: MailboxAdminRow) => {
    setTests((t) => ({ ...t, [m.id]: { status: "running" } }));
    try {
      const res = await fetch(`/api/admin/mailboxes/${m.id}/test`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setTests((t) => ({
          ...t,
          [m.id]: {
            status: "ok",
            folders: data.folders,
            inboxTotal: data.inboxTotal,
            inboxUnseen: data.inboxUnseen,
          },
        }));
      } else {
        setTests((t) => ({ ...t, [m.id]: { status: "error", error: data.error } }));
      }
    } catch (e) {
      setTests((t) => ({
        ...t,
        [m.id]: { status: "error", error: e instanceof Error ? e.message : "failed" },
      }));
    }
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Mailboxes</h1>
          <p className="text-sm text-slate-500">
            {loading ? "Loading…" : `${mailboxes.length} source streams`}
          </p>
        </div>
        <button
          onClick={() => setEdit("new")}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
        >
          + Add Mailbox
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      <div className="grid gap-3">
        {mailboxes.map((m) => {
          const t = tests[m.id] ?? { status: "idle" };
          return (
            <div key={m.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{m.displayName}</span>
                    <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                      {m.key}
                    </code>
                    {m.inbound ? (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        inbound
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                        manual
                      </span>
                    )}
                    {!m.active && (
                      <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-500">
                        inactive
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {m.inbound ? (
                      <>
                        {m.imapUser ?? "—"} @ {m.imapHost ?? "—"}:{m.imapPort ?? "—"}{" "}
                        {m.imapSecure ? "(TLS)" : "(no TLS)"}
                        {m.allowSelfSigned ? " · self-signed OK" : ""}
                      </>
                    ) : (
                      "Not polled (manual task source)"
                    )}
                    {" · "}
                    {m._count.tasks} tasks · {m._count.emailUpdates} emails
                  </div>
                  {m.inbound && (
                    <div className="mt-1 text-xs">
                      {m.passwordSet ? (
                        <span className="text-emerald-600">● password set</span>
                      ) : (
                        <span className="text-amber-600">
                          ● no password — set env{" "}
                          <code className="rounded bg-amber-50 px-1">{m.passwordEnvVar}</code>
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-1">
                  {m.inbound && (
                    <button
                      onClick={() => test(m)}
                      disabled={t.status === "running"}
                      className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                    >
                      {t.status === "running" ? "Testing…" : "Test connection"}
                    </button>
                  )}
                  <button
                    onClick={() => setEdit(m)}
                    className="rounded-md px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                  >
                    Edit
                  </button>
                  {m._count.tasks === 0 && m._count.emailUpdates === 0 && (
                    <button
                      onClick={() => remove(m)}
                      className="rounded-md px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>

              {t.status === "ok" && (
                <div className="mt-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  ✓ Connected. INBOX: {t.inboxTotal} total, {t.inboxUnseen} unseen.{" "}
                  {t.folders.length} folders.
                </div>
              )}
              {t.status === "error" && (
                <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
                  ✗ {t.error}
                </div>
              )}
            </div>
          );
        })}
        {!loading && mailboxes.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-300 px-6 py-12 text-center text-slate-400">
            No mailboxes yet.
          </div>
        )}
      </div>

      {edit && (
        <MailboxForm
          mailbox={edit === "new" ? null : edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function MailboxForm({
  mailbox,
  onClose,
  onSaved,
}: {
  mailbox: MailboxAdminRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !mailbox;
  const [key, setKey] = useState(mailbox?.key ?? "");
  const [displayName, setDisplayName] = useState(mailbox?.displayName ?? "");
  const [address, setAddress] = useState(mailbox?.address ?? "");
  const [inbound, setInbound] = useState(mailbox?.inbound ?? true);
  const [active, setActive] = useState(mailbox?.active ?? true);
  const [imapHost, setImapHost] = useState(mailbox?.imapHost ?? "");
  const [imapPort, setImapPort] = useState(String(mailbox?.imapPort ?? 993));
  const [imapSecure, setImapSecure] = useState(mailbox?.imapSecure ?? true);
  const [imapUser, setImapUser] = useState(mailbox?.imapUser ?? "");
  const [allowSelfSigned, setAllowSelfSigned] = useState(mailbox?.allowSelfSigned ?? false);
  const [processedFolder, setProcessedFolder] = useState(mailbox?.processedFolder ?? "");
  const [failedFolder, setFailedFolder] = useState(mailbox?.failedFolder ?? "");
  const [moveProcessed, setMoveProcessed] = useState(mailbox?.moveProcessed ?? false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setErr(null);
    const payload = {
      ...(isNew ? { key } : {}),
      displayName,
      address: address || null,
      inbound,
      active,
      imapHost: inbound ? imapHost || null : null,
      imapPort: inbound ? Number(imapPort) || 993 : null,
      imapSecure,
      imapUser: inbound ? imapUser || null : null,
      allowSelfSigned,
      processedFolder: processedFolder || null,
      failedFolder: failedFolder || null,
      moveProcessed,
    };
    try {
      const res = await fetch(
        isNew ? "/api/admin/mailboxes" : `/api/admin/mailboxes/${mailbox!.id}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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

  const envVar = `IMAP_PASSWORD_${(key || "key").toUpperCase().replace(/[^A-Z0-9]/g, "_")}`;

  return (
    <Modal open onClose={onClose} title={isNew ? "Add Mailbox" : `Edit ${mailbox!.displayName}`} wide>
      {err && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Key</span>
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            disabled={!isNew}
            placeholder="om"
            className={`${inputCls} ${!isNew ? "bg-slate-100 text-slate-500" : ""}`}
          />
          {isNew && <span className="text-xs text-slate-400">lowercase id, immutable (e.g. cmo, om)</span>}
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">Display name</span>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={inputCls} placeholder="OM" />
        </label>
      </div>

      <div className="mt-3 flex gap-4">
        <label className="flex items-center gap-1.5 text-sm text-slate-700">
          <input type="checkbox" checked={inbound} onChange={(e) => setInbound(e.target.checked)} />
          Inbound (poll over IMAP)
        </label>
        <label className="flex items-center gap-1.5 text-sm text-slate-700">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
          Active
        </label>
      </div>

      {inbound && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <label className="col-span-2 block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Mailbox address</span>
              <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} placeholder="tracker-om@fwsom.com" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">IMAP host</span>
              <input value={imapHost} onChange={(e) => setImapHost(e.target.value)} className={inputCls} placeholder="mail.fwsom.com" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">IMAP user</span>
              <input value={imapUser} onChange={(e) => setImapUser(e.target.value)} className={inputCls} placeholder="tracker-om@fwsom.com" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Port</span>
              <input value={imapPort} onChange={(e) => setImapPort(e.target.value)} className={inputCls} placeholder="993" />
            </label>
            <div className="flex items-end gap-4">
              <label className="flex items-center gap-1.5 text-sm text-slate-700">
                <input type="checkbox" checked={imapSecure} onChange={(e) => setImapSecure(e.target.checked)} />
                TLS (993)
              </label>
              <label className="flex items-center gap-1.5 text-sm text-slate-700">
                <input type="checkbox" checked={allowSelfSigned} onChange={(e) => setAllowSelfSigned(e.target.checked)} />
                Allow self-signed
              </label>
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Processed folder</span>
              <input value={processedFolder} onChange={(e) => setProcessedFolder(e.target.value)} className={inputCls} placeholder="INBOX.Processed" />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Failed folder</span>
              <input value={failedFolder} onChange={(e) => setFailedFolder(e.target.value)} className={inputCls} placeholder="INBOX.Failed" />
            </label>
          </div>
          <label className="mt-3 flex items-center gap-1.5 text-sm text-slate-700">
            <input type="checkbox" checked={moveProcessed} onChange={(e) => setMoveProcessed(e.target.checked)} />
            Move handled mail to the Processed folder (else just flag \Seen)
          </label>
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            🔑 The password is <strong>not</strong> stored here. After saving, set the environment
            variable <code className="rounded bg-amber-100 px-1">{envVar}</code> on the server, then
            use “Test connection”.
          </p>
        </>
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={saving || !displayName.trim() || (isNew && !key.trim())}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}

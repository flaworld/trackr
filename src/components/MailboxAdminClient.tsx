"use client";
import { useCallback, useEffect, useState } from "react";
import { Inbox, Plug, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { MailboxAdminRow } from "@/lib/types";

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
    toast.success(`Mailbox "${m.displayName}" deleted`);
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Inbox className="h-4 w-4" />
          {loading ? "Loading…" : `${mailboxes.length} source streams`}
        </div>
        <Button onClick={() => setEdit("new")}>
          <Plus /> Add Mailbox
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {mailboxes.map((m) => {
            const t = tests[m.id] ?? { status: "idle" };
            return (
              <Card key={m.id}>
                <CardContent className="space-y-3 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{m.displayName}</span>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          {m.key}
                        </code>
                        <Badge variant={m.inbound ? "secondary" : "muted"}>
                          {m.inbound ? "inbound" : "manual"}
                        </Badge>
                        {!m.active && <Badge variant="muted">inactive</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground">
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
                        <div className="text-xs">
                          {m.passwordSet ? (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              ● password set
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400">
                              ● no password — set env <code>{m.passwordEnvVar}</code>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1.5">
                      {m.inbound && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => test(m)}
                          disabled={t.status === "running"}
                        >
                          <Plug /> {t.status === "running" ? "Testing…" : "Test connection"}
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setEdit(m)}>
                        Edit
                      </Button>
                      {m._count.tasks === 0 && m._count.emailUpdates === 0 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          title="Delete"
                          onClick={() => remove(m)}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  </div>

                  {t.status === "ok" && (
                    <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      ✓ Connected. INBOX: {t.inboxTotal} total, {t.inboxUnseen} unseen.{" "}
                      {t.folders.length} folders.
                    </div>
                  )}
                  {t.status === "error" && (
                    <div className="rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      ✗ {t.error}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
          {mailboxes.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No mailboxes yet.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {edit && (
        <MailboxDialog
          mailbox={edit === "new" ? null : edit}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            toast.success(edit === "new" ? "Mailbox created" : "Mailbox updated");
            load();
          }}
        />
      )}
    </div>
  );
}

function MailboxDialog({
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add Mailbox" : `Edit ${mailbox!.displayName}`}</DialogTitle>
        </DialogHeader>
        {err && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Key</Label>
            <Input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              disabled={!isNew}
              placeholder="om"
            />
            {isNew && (
              <p className="text-xs text-muted-foreground">
                lowercase id, immutable (e.g. cmo, om)
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label>Display name</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="OM"
            />
          </div>
        </div>

        <div className="flex gap-6">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={inbound} onCheckedChange={(v) => setInbound(v === true)} />
            Inbound (poll over IMAP)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={active} onCheckedChange={(v) => setActive(v === true)} />
            Active
          </label>
        </div>

        {inbound && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-1.5">
                <Label>Mailbox address</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="tracker-om@fwsom.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>IMAP host</Label>
                <Input
                  value={imapHost}
                  onChange={(e) => setImapHost(e.target.value)}
                  placeholder="mail.fwsom.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>IMAP user</Label>
                <Input
                  value={imapUser}
                  onChange={(e) => setImapUser(e.target.value)}
                  placeholder="tracker-om@fwsom.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Port</Label>
                <Input
                  value={imapPort}
                  onChange={(e) => setImapPort(e.target.value)}
                  placeholder="993"
                />
              </div>
              <div className="flex items-end gap-5 pb-1">
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={imapSecure}
                    onCheckedChange={(v) => setImapSecure(v === true)}
                  />
                  TLS (993)
                </label>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={allowSelfSigned}
                    onCheckedChange={(v) => setAllowSelfSigned(v === true)}
                  />
                  Allow self-signed
                </label>
              </div>
              <div className="space-y-1.5">
                <Label>Processed folder</Label>
                <Input
                  value={processedFolder}
                  onChange={(e) => setProcessedFolder(e.target.value)}
                  placeholder="INBOX.Processed"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Failed folder</Label>
                <Input
                  value={failedFolder}
                  onChange={(e) => setFailedFolder(e.target.value)}
                  placeholder="INBOX.Failed"
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={moveProcessed}
                onCheckedChange={(v) => setMoveProcessed(v === true)}
              />
              Move handled mail to the Processed folder (else just flag \Seen)
            </label>
            <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              🔑 The password is <strong>not</strong> stored here. After saving, set the
              environment variable <code className="font-semibold">{envVar}</code> on the
              server, then use "Test connection".
            </div>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={saving || !displayName.trim() || (isNew && !key.trim())}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

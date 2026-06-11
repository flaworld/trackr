"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Upload, Users } from "lucide-react";
import { toast } from "sonner";
import { ROLES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AdminUser, MailboxAdmin } from "@/lib/types";

const NONE = "__none__";

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
    const res = await fetch(`/api/admin/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !u.active }),
    });
    if (res.ok) toast.success(u.active ? "User deactivated" : "User reactivated");
    load();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          {loading ? "Loading…" : `${users.length} users`}
          <label className="ml-4 flex cursor-pointer items-center gap-2">
            <Checkbox
              checked={showInactive}
              onCheckedChange={(v) => setShowInactive(v === true)}
            />
            Show deactivated
          </label>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setImporting(true)}>
            <Upload /> Import CSV
          </Button>
          <Button onClick={() => setEdit("new")}>
            <Plus /> Add User
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        {loading ? (
          <div className="space-y-3 p-6">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Sign-in</TableHead>
                <TableHead>Access</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((u) => (
                <TableRow key={u.id} className={u.active ? "" : "opacity-50"}>
                  <TableCell className="font-medium">
                    {u.name}
                    {u.id === currentUserId && (
                      <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                        (you)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{u.email}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.manager?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.authMethods.length ? u.authMethods.join(", ") : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.mailboxAccess.length
                      ? u.mailboxAccess
                          .map(
                            (g) =>
                              `${g.mailbox.displayName}${g.canViewAll ? "·view" : ""}${g.canReview ? "·review" : ""}`,
                          )
                          .join(", ")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="muted"
                      className={
                        u.active
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          : ""
                      }
                    >
                      {u.active ? "active" : "deactivated"}
                    </Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <Button variant="ghost" size="sm" onClick={() => setEdit(u)}>
                      Edit
                    </Button>
                    {u.id !== currentUserId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => toggleActive(u)}
                      >
                        {u.active ? "Deactivate" : "Reactivate"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {shown.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="py-12 text-center text-muted-foreground">
                    No users.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      {edit && (
        <UserDialog
          user={edit === "new" ? null : edit}
          users={users}
          mailboxes={mailboxes}
          isSelf={edit !== "new" && edit.id === currentUserId}
          onClose={() => setEdit(null)}
          onSaved={() => {
            setEdit(null);
            toast.success(edit === "new" ? "User created" : "User updated");
            load();
          }}
        />
      )}
      {importing && (
        <ImportDialog
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

function UserDialog({
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
  const [managerId, setManagerId] = useState(user?.managerId ?? NONE);
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
            managerId: managerId === NONE ? null : managerId,
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
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isNew ? "Add User" : `Edit ${user!.name}`}</DialogTitle>
          {isNew && (
            <DialogDescription>
              Use their Microsoft 365 email — they'll sign in with SSO.
            </DialogDescription>
          )}
        </DialogHeader>
        {err && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label>Email (M365)</Label>
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!isNew}
              placeholder="person@fwsom.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={setRole} disabled={isSelf}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r} value={r} className="capitalize">
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isSelf && (
              <p className="text-xs text-muted-foreground">Can't change your own role</p>
            )}
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Manager</Label>
            <Select value={managerId} onValueChange={setManagerId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— none —</SelectItem>
                {managerOptions.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Mailbox access</Label>
          <div className="space-y-2.5 rounded-lg border p-4">
            {mailboxes.map((m) => (
              <div key={m.id} className="flex items-center justify-between text-sm">
                <span>
                  {m.displayName}
                  {m.inbound && (
                    <span className="ml-1.5 text-xs text-muted-foreground">(inbound)</span>
                  )}
                </span>
                <div className="flex gap-5">
                  <label className="flex cursor-pointer items-center gap-2 text-xs">
                    <Checkbox
                      checked={grants[m.id]?.canViewAll ?? false}
                      onCheckedChange={(v) => setGrant(m.id, "canViewAll", v === true)}
                    />
                    View all
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-xs">
                    <Checkbox
                      checked={grants[m.id]?.canReview ?? false}
                      onCheckedChange={(v) => setGrant(m.id, "canReview", v === true)}
                    />
                    Review
                  </label>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            "View all" shows the entire mailbox stream (e.g. CMO Tracker). "Review" allows
            approving that mailbox's email suggestions.
          </p>
        </div>

        <div className="space-y-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={setPw} onCheckedChange={(v) => setSetPw(v === true)} />
            Set a password (fallback login){user?.hasPassword ? " — replaces existing" : ""}
          </label>
          {setPw ? (
            <Input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="min 8 characters (leave blank to clear)"
            />
          ) : (
            <p className="text-xs text-muted-foreground">
              Leave unchecked for Microsoft-only sign-in.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || (isNew && !email.trim())}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
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
      const data = await res.json();
      setResult(data);
      toast.success(`Imported: ${data.created} created, ${data.updated} updated`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import users from CSV</DialogTitle>
          <DialogDescription>
            Header row required. Columns: <code>email</code> (required), <code>name</code>,{" "}
            <code>role</code> (admin/manager/member/viewer), <code>manager</code> (manager's
            email). Existing users are updated; managers are linked after all rows are created.
          </DialogDescription>
        </DialogHeader>
        {err && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
          </div>
        )}
        <Textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={10}
          spellCheck={false}
          className="font-mono text-xs"
          placeholder={
            "email,name,role,manager\njane@fwsom.com,Jane Doe,manager,\nbob@fwsom.com,Bob Lee,member,jane@fwsom.com"
          }
        />
        {result && (
          <div className="rounded-lg bg-muted p-4 text-sm">
            <p className="font-medium">
              Created {result.created} · Updated {result.updated} · Errors{" "}
              {result.errors.length}
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs text-destructive">
                {result.errors.map((e, i) => (
                  <li key={i}>
                    {e.email}: {e.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={result ? onDone : onClose}>
            {result ? "Done" : "Cancel"}
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

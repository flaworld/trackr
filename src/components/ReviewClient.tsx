"use client";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Inbox, Link2, Mail, XCircle } from "lucide-react";
import { toast } from "sonner";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ConfidenceBadge, StatusBadge } from "./Badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SuggestionRow, TaskRow } from "@/lib/types";

type Band = "all" | "high" | "review" | "unmatched";

export function ReviewClient() {
  const [items, setItems] = useState<SuggestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [band, setBand] = useState<Band>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkFor, setLinkFor] = useState<SuggestionRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/email-updates/review${band !== "all" ? `?band=${band}` : ""}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setItems((await res.json()).suggestions);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [band]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id: string, action: "approve" | "reject") => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/email-updates/${id}/${action}`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Action failed");
      setItems((prev) => prev.filter((s) => s.id !== id));
      toast.success(action === "approve" ? "Update applied to the task" : "Suggestion rejected");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Review Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading
              ? "Loading…"
              : `${items.length} pending suggestion${items.length === 1 ? "" : "s"}`}{" "}
            · approve to apply to the tracker
          </p>
        </div>
        <Tabs value={band} onValueChange={(v) => setBand(v as Band)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="high">High confidence</TabsTrigger>
            <TabsTrigger value="review">Needs review</TabsTrigger>
            <TabsTrigger value="unmatched">Unmatched</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-muted">
              <Inbox className="h-7 w-7 text-muted-foreground" />
            </span>
            <p className="font-medium">All caught up 🎉</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Emails forwarded to the tracker mailboxes will appear here for approval.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((s) => (
            <ReviewCard
              key={s.id}
              s={s}
              busy={busyId === s.id}
              onApprove={() => act(s.id, "approve")}
              onReject={() => act(s.id, "reject")}
              onLink={() => setLinkFor(s)}
            />
          ))}
        </div>
      )}

      {linkFor && (
        <LinkTaskDialog
          suggestion={linkFor}
          onClose={() => setLinkFor(null)}
          onDone={() => {
            setLinkFor(null);
            toast.success("Task linked");
            load();
          }}
        />
      )}
    </div>
  );
}

function ReviewCard({
  s,
  busy,
  onApprove,
  onReject,
  onLink,
}: {
  s: SuggestionRow;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
  onLink: () => void;
}) {
  const e = s.emailUpdate;
  const [showBody, setShowBody] = useState(false);
  const canApprove = Boolean(s.taskId);

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate font-semibold">{e.subject || "(no subject)"}</span>
              <ConfidenceBadge score={s.confidenceScore} />
              {e.mailbox && <Badge variant="muted">{e.mailbox.displayName}</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {e.fromName ? `${e.fromName} ` : ""}&lt;{e.fromEmail}&gt; · received{" "}
              {fmtDateTime(e.receivedAt)}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Suggested update
          </p>
          <dl className="space-y-2 text-sm">
            <Row label="Task">
              {s.task ? (
                <span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {s.task.taskCode}
                  </span>{" "}
                  {s.task.taskName}
                </span>
              ) : (
                <span className="font-medium text-rose-600 dark:text-rose-400">
                  Unmatched — link a task first
                </span>
              )}
            </Row>
            <Row label="Status">
              {s.suggestedStatus ? <StatusBadge status={s.suggestedStatus} /> : <Dash />}
            </Row>
            <Row label="Due date">{s.suggestedDueDate ? fmtDate(s.suggestedDueDate) : <Dash />}</Row>
            <Row label="Notes">
              <span className="text-muted-foreground">{s.suggestedNotes || "—"}</span>
            </Row>
            {s.reason && (
              <Row label="Why">
                <span className="text-xs italic text-muted-foreground">{s.reason}</span>
              </Row>
            )}
          </dl>
        </div>

        <div className="space-y-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Original email
          </p>
          <div className="rounded-lg bg-muted/60 p-3 text-sm">
            <p className={cn("whitespace-pre-wrap", !showBody && "line-clamp-4")}>
              {e.bodyText || "(empty body)"}
            </p>
            {(e.bodyText?.length ?? 0) > 160 && (
              <button
                onClick={() => setShowBody((v) => !v)}
                className="mt-1.5 text-xs font-medium text-primary hover:underline"
              >
                {showBody ? "Show less" : "Show more"}
              </button>
            )}
          </div>
          {e.attachments.length > 0 && (
            <p className="text-xs text-muted-foreground">
              📎 {e.attachments.map((a) => a.filename || "attachment").join(", ")}
            </p>
          )}
        </div>
      </CardContent>

      <CardFooter className="justify-end gap-2 border-t pt-4">
        <Button variant="outline" size="sm" onClick={onLink} disabled={busy}>
          <Link2 /> Link / create task
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onReject}
          disabled={busy}
          className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <XCircle /> Reject
        </Button>
        <Button
          variant="success"
          size="sm"
          onClick={onApprove}
          disabled={busy || !canApprove}
          title={canApprove ? "" : "Link a task before approving"}
        >
          <CheckCircle2 /> {busy ? "Working…" : "Approve & apply"}
        </Button>
      </CardFooter>
    </Card>
  );
}

function LinkTaskDialog({
  suggestion,
  onClose,
  onDone,
}: {
  suggestion: SuggestionRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const NONE = "__none__";
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [taskId, setTaskId] = useState(NONE);
  const [newName, setNewName] = useState(
    suggestion.emailUpdate.subject?.replace(/^(re|fwd|fw):\s*/i, "") ?? "",
  );
  const [tab, setTab] = useState<"link" | "create">("link");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tasks?view=all", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : fetch("/api/tasks").then((r2) => r2.json())))
      .then((d) => setTasks(d.tasks ?? []))
      .catch(() => setTasks([]));
  }, []);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const body =
        tab === "create" ? { createNew: true, taskName: newName } : { taskId };
      const res = await fetch(`/api/email-updates/${suggestion.id}/link-task`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link or create task</DialogTitle>
        </DialogHeader>
        {err && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
          </div>
        )}
        <Tabs value={tab} onValueChange={(v) => setTab(v as "link" | "create")}>
          <TabsList className="w-full">
            <TabsTrigger value="link" className="flex-1">
              Link existing
            </TabsTrigger>
            <TabsTrigger value="create" className="flex-1">
              Create new
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {tab === "link" ? (
          <Select value={taskId} onValueChange={setTaskId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a task…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE} disabled>
                Select a task…
              </SelectItem>
              {tasks.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.taskCode} — {t.taskName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="New task name"
          />
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={busy || (tab === "link" ? taskId === NONE : !newName.trim())}
          >
            {busy ? "Saving…" : tab === "create" ? "Create & link" : "Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-20 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}
function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  CalendarDays,
  History,
  Inbox,
  Mail,
  Pencil,
  Plus,
  Search,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { TASK_STATUSES, PRIORITIES } from "@/lib/constants";
import { fmtDate, fmtDateTime, toDateInput } from "@/lib/format";
import { cn } from "@/lib/cn";
import { StatusBadge, PriorityBadge } from "./Badge";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  TaskRow,
  UserLite,
  MailboxLite,
  ViewOption,
  Permissions,
  HistoryRow,
  EmailUpdateRow,
} from "@/lib/types";

type EditMode = "full" | "notes" | null;
const ALL = "__all__";

export function TrackerClient({
  users,
  mailboxes,
  views,
  perms,
  currentUserId,
}: {
  users: UserLite[];
  mailboxes: MailboxLite[];
  views: ViewOption[];
  perms: Permissions;
  currentUserId: string;
}) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  const [view, setView] = useState(views.length ? views[views.length - 1].key : "my");

  const [fStatus, setFStatus] = useState(ALL);
  const [fOwner, setFOwner] = useState(ALL);
  const [fMailbox, setFMailbox] = useState(ALL);
  const [fPriority, setFPriority] = useState(ALL);
  const [fOverdue, setFOverdue] = useState(false);
  const [fSearch, setFSearch] = useState("");

  const [formTask, setFormTask] = useState<TaskRow | "new" | null>(null);
  const [formMode, setFormMode] = useState<EditMode>(null);
  const [historyTask, setHistoryTask] = useState<TaskRow | null>(null);
  const [emailTask, setEmailTask] = useState<TaskRow | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    const p = new URLSearchParams();
    if (view) p.set("view", view);
    if (fStatus !== ALL) p.set("status", fStatus);
    if (fOwner !== ALL) p.set("ownerId", fOwner);
    if (fMailbox !== ALL) p.set("mailboxId", fMailbox);
    if (fPriority !== ALL) p.set("priority", fPriority);
    if (fOverdue) p.set("overdue", "true");
    if (fSearch.trim()) p.set("search", fSearch.trim());
    try {
      const res = await fetch(`/api/tasks?${p.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load");
      setTasks((await res.json()).tasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [view, fStatus, fOwner, fMailbox, fPriority, fOverdue, fSearch]);

  useEffect(() => {
    const t = setTimeout(fetchTasks, fSearch ? 300 : 0);
    return () => clearTimeout(t);
  }, [fetchTasks, fSearch]);

  const canEditRow = (t: TaskRow): EditMode => {
    if (perms.canEditAny) return "full";
    if (perms.canEditAssigned && t.ownerId === currentUserId) return "full";
    if (perms.canAddNotes && t.ownerId === currentUserId) return "notes";
    return null;
  };

  const columns = useMemo(() => {
    const col = createColumnHelper<TaskRow>();
    return [
      col.accessor("taskCode", {
        header: "Task",
        cell: (c) => (
          <span className="font-mono text-xs font-medium text-muted-foreground">
            {c.getValue()}
          </span>
        ),
      }),
      col.accessor("taskName", {
        header: "Name",
        cell: (c) => (
          <div className="min-w-[14rem] max-w-[22rem]">
            <div className="font-medium">{c.getValue()}</div>
            {c.row.original.latestNotes && (
              <div
                className="mt-0.5 line-clamp-1 text-xs text-muted-foreground"
                title={c.row.original.latestNotes}
              >
                {c.row.original.latestNotes}
              </div>
            )}
          </div>
        ),
      }),
      col.accessor((r) => r.owner?.name ?? "—", {
        id: "owner",
        header: "Owner",
        cell: (c) => <span className="whitespace-nowrap">{c.getValue()}</span>,
      }),
      col.accessor((r) => r.mailbox?.displayName ?? "—", {
        id: "mailbox",
        header: "Source",
        cell: (c) =>
          c.getValue() === "—" ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            <Badge variant="muted">{c.getValue()}</Badge>
          ),
      }),
      col.accessor("displayStatus", {
        header: "Status",
        cell: (c) => <StatusBadge status={c.getValue()} />,
      }),
      col.accessor("priority", {
        header: "Priority",
        cell: (c) => <PriorityBadge priority={c.getValue()} />,
      }),
      col.accessor("dueDate", {
        header: "Due",
        cell: (c) => (
          <span
            className={cn(
              "whitespace-nowrap",
              c.row.original.isOverdue ? "font-medium text-rose-600 dark:text-rose-400" : "",
            )}
          >
            {fmtDate(c.getValue())}
          </span>
        ),
      }),
      col.accessor("lastUpdated", {
        header: "Updated",
        cell: (c) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {fmtDateTime(c.getValue())}
          </span>
        ),
      }),
      col.display({
        id: "actions",
        header: "",
        cell: (c) => {
          const t = c.row.original;
          const mode = canEditRow(t);
          const emails = t._count?.matchedEmails ?? 0;
          return (
            <div className="flex items-center justify-end gap-0.5">
              {emails > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  title={`${emails} linked email${emails > 1 ? "s" : ""}`}
                  onClick={() => setEmailTask(t)}
                >
                  <Mail className="text-violet-500" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                title="History"
                onClick={() => setHistoryTask(t)}
              >
                <History />
              </Button>
              {mode && (
                <Button
                  variant="ghost"
                  size="icon"
                  title={mode === "notes" ? "Add note" : "Edit"}
                  onClick={() => {
                    setFormMode(mode);
                    setFormTask(t);
                  }}
                >
                  {mode === "notes" ? <StickyNote /> : <Pencil />}
                </Button>
              )}
            </div>
          );
        },
      }),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perms, currentUserId]);

  const table = useReactTable({
    data: tasks,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const clearFilters = () => {
    setFStatus(ALL);
    setFOwner(ALL);
    setFMailbox(ALL);
    setFPriority(ALL);
    setFOverdue(false);
    setFSearch("");
  };
  const anyFilter =
    fStatus !== ALL || fOwner !== ALL || fMailbox !== ALL || fPriority !== ALL || fOverdue || fSearch;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {loading ? "Loading…" : `${tasks.length} task${tasks.length === 1 ? "" : "s"} in view`}
          </p>
        </div>
        {perms.canCreate && (
          <Button
            onClick={() => {
              setFormMode("full");
              setFormTask("new");
            }}
          >
            <Plus /> New Task
          </Button>
        )}
      </div>

      {/* View switcher */}
      {views.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                view === v.key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      {/* Filter toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={fSearch}
            onChange={(e) => setFSearch(e.target.value)}
            placeholder="Search tasks, codes, notes…"
            className="pl-9"
          />
        </div>
        <Select value={fStatus} onValueChange={setFStatus}>
          <SelectTrigger className="w-auto min-w-[10rem]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fOwner} onValueChange={setFOwner}>
          <SelectTrigger className="w-auto min-w-[9rem]">
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All owners</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fMailbox} onValueChange={setFMailbox}>
          <SelectTrigger className="w-auto min-w-[9rem]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All sources</SelectItem>
            {mailboxes.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.displayName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={fPriority} onValueChange={setFPriority}>
          <SelectTrigger className="w-auto min-w-[9rem]">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All priorities</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex h-10 cursor-pointer items-center gap-2 rounded-md border border-input bg-card px-3 text-sm shadow-sm">
          <Checkbox checked={fOverdue} onCheckedChange={(v) => setFOverdue(v === true)} />
          Overdue
        </label>
        {anyFilter && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            Clear
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
        {loading ? (
          <div className="space-y-3 p-6">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : tasks.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-muted">
              <Inbox className="h-7 w-7 text-muted-foreground" />
            </span>
            <p className="font-medium">No tasks here</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {anyFilter
                ? "Nothing matches your filters. Try clearing them."
                : "Tasks you can see will appear here — create one or forward an email to the tracker mailbox."}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="bg-muted/50">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="hover:bg-transparent">
                  {hg.headers.map((h) => (
                    <TableHead key={h.id}>
                      {h.column.getCanSort() ? (
                        <button
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          onClick={h.column.getToggleSortingHandler()}
                        >
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          <ArrowUpDown className="h-3 w-3 opacity-50" />
                        </button>
                      ) : (
                        flexRender(h.column.columnDef.header, h.getContext())
                      )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {formTask && (
        <TaskForm
          task={formTask === "new" ? null : formTask}
          mode={formMode ?? "full"}
          users={users}
          onClose={() => setFormTask(null)}
          onSaved={() => {
            setFormTask(null);
            toast.success(formTask === "new" ? "Task created" : "Task updated");
            fetchTasks();
          }}
        />
      )}
      {historyTask && <HistoryDialog task={historyTask} onClose={() => setHistoryTask(null)} />}
      {emailTask && <EmailUpdatesDialog task={emailTask} onClose={() => setEmailTask(null)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
function TaskForm({
  task,
  mode,
  users,
  onClose,
  onSaved,
}: {
  task: TaskRow | null;
  mode: EditMode;
  users: UserLite[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !task;
  const notesOnly = mode === "notes";
  const NONE = "__none__";
  const [taskName, setTaskName] = useState(task?.taskName ?? "");
  const [ownerId, setOwnerId] = useState(task?.ownerId ?? NONE);
  const [status, setStatus] = useState(task?.status ?? "Not Started");
  const [priority, setPriority] = useState(task?.priority ?? "Medium");
  const [dueDate, setDueDate] = useState(toDateInput(task?.dueDate));
  const [latestNotes, setLatestNotes] = useState(task?.latestNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setErr(null);
    try {
      const payload: Record<string, unknown> = notesOnly
        ? { latestNotes }
        : {
            taskName,
            ownerId: ownerId === NONE ? null : ownerId,
            status,
            priority,
            dueDate: dueDate ? new Date(dueDate).toISOString() : null,
            latestNotes,
          };
      const res = await fetch(isNew ? "/api/tasks" : `/api/tasks/${task!.id}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Save failed");
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isNew ? "New Task" : notesOnly ? "Add Note" : `Edit ${task!.taskCode}`}
          </DialogTitle>
        </DialogHeader>

        {err && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {err}
          </div>
        )}

        <div className="space-y-4">
          {!notesOnly && (
            <>
              <div className="space-y-1.5">
                <Label>Task name</Label>
                <Input
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder="e.g. Launch Q3 webinar"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Owner</Label>
                  <Select value={ownerId} onValueChange={setOwnerId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Unassigned</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Priority</Label>
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.filter((s) => s !== "Overdue").map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Due date</Label>
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea
              value={latestNotes}
              onChange={(e) => setLatestNotes(e.target.value)}
              rows={3}
              placeholder="Latest update / context…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || (!notesOnly && !taskName.trim())}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
function HistoryDialog({ task, onClose }: { task: TaskRow; onClose: () => void }) {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  useEffect(() => {
    fetch(`/api/tasks/${task.id}/history`)
      .then((r) => r.json())
      .then((d) => setRows(d.history))
      .catch(() => setRows([]));
  }, [task.id]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            History · <span className="font-mono text-base">{task.taskCode}</span>
          </DialogTitle>
        </DialogHeader>
        {!rows ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No history yet.</p>
        ) : (
          <ol className="relative space-y-5 border-l pl-5">
            {rows.map((h) => (
              <li key={h.id} className="relative">
                <span className="absolute -left-[1.45rem] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-card" />
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={h.sourceType === "email" ? "secondary" : "muted"}>
                    {h.sourceType}
                  </Badge>
                  <CalendarDays className="h-3 w-3" />
                  {fmtDateTime(h.createdAt)}
                  {h.changedBy && <span>· {h.changedBy.name}</span>}
                </div>
                <div className="mt-1.5 space-y-0.5 text-sm">
                  {h.newStatus && (
                    <div className="flex items-center gap-2">
                      {h.previousStatus && (
                        <>
                          <StatusBadge status={h.previousStatus} />
                          <span className="text-muted-foreground">→</span>
                        </>
                      )}
                      <StatusBadge status={h.newStatus} />
                    </div>
                  )}
                  {h.newDueDate && (
                    <div>
                      Due:{" "}
                      {h.previousDueDate && (
                        <span className="text-muted-foreground">
                          {fmtDate(h.previousDueDate)} →{" "}
                        </span>
                      )}
                      <span className="font-medium">{fmtDate(h.newDueDate)}</span>
                    </div>
                  )}
                  {h.notes && <p className="text-muted-foreground">{h.notes}</p>}
                  {h.sourceEmail && (
                    <p className="text-xs text-violet-600 dark:text-violet-400">
                      via email: {h.sourceEmail.subject} ({h.sourceEmail.fromEmail})
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
function EmailUpdatesDialog({ task, onClose }: { task: TaskRow; onClose: () => void }) {
  const [rows, setRows] = useState<EmailUpdateRow[] | null>(null);
  useEffect(() => {
    fetch(`/api/tasks/${task.id}/email-updates`)
      .then((r) => r.json())
      .then((d) => setRows(d.emailUpdates))
      .catch(() => setRows([]));
  }, [task.id]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Linked emails · <span className="font-mono text-base">{task.taskCode}</span>
          </DialogTitle>
        </DialogHeader>
        {!rows ? (
          <Skeleton className="h-24 w-full" />
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No linked emails.</p>
        ) : (
          <div className="space-y-3">
            {rows.map((e) => (
              <div key={e.id} className="rounded-lg border p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-medium">{e.subject || "(no subject)"}</span>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {fmtDateTime(e.receivedAt)}
                  </span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {e.fromName} &lt;{e.fromEmail}&gt; · {e.processingStatus}
                  {e.matchConfidence != null && ` · ${e.matchConfidence}%`}
                </div>
                {e.extractedSummary && (
                  <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">
                    {e.extractedSummary}
                  </p>
                )}
                {e.attachments.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    📎 {e.attachments.map((a) => a.filename).join(", ")}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

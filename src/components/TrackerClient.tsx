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
import { TASK_STATUSES, PRIORITIES } from "@/lib/constants";
import {
  fmtDate,
  fmtDateTime,
  toDateInput,
} from "@/lib/format";
import { StatusBadge, PriorityBadge } from "./Badge";
import { Modal } from "./Modal";
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

  // view (default to the broadest the user has — last in the list)
  const [view, setView] = useState(
    views.length ? views[views.length - 1].key : "my",
  );

  // filters
  const [fStatus, setFStatus] = useState("");
  const [fOwner, setFOwner] = useState("");
  const [fMailbox, setFMailbox] = useState("");
  const [fPriority, setFPriority] = useState("");
  const [fOverdue, setFOverdue] = useState(false);
  const [fSearch, setFSearch] = useState("");

  // modals
  const [formTask, setFormTask] = useState<TaskRow | "new" | null>(null);
  const [formMode, setFormMode] = useState<EditMode>(null);
  const [historyTask, setHistoryTask] = useState<TaskRow | null>(null);
  const [emailTask, setEmailTask] = useState<TaskRow | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    const p = new URLSearchParams();
    if (view) p.set("view", view);
    if (fStatus) p.set("status", fStatus);
    if (fOwner) p.set("ownerId", fOwner);
    if (fMailbox) p.set("mailboxId", fMailbox);
    if (fPriority) p.set("priority", fPriority);
    if (fOverdue) p.set("overdue", "true");
    if (fSearch.trim()) p.set("search", fSearch.trim());
    try {
      const res = await fetch(`/api/tasks?${p.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load");
      const data = await res.json();
      setTasks(data.tasks);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tasks");
    } finally {
      setLoading(false);
    }
  }, [view, fStatus, fOwner, fMailbox, fPriority, fOverdue, fSearch]);

  // Debounce search; immediate for other filters.
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
        header: "Task Code",
        cell: (c) => (
          <span className="font-mono text-xs font-medium text-slate-600">
            {c.getValue()}
          </span>
        ),
      }),
      col.accessor("assignedDate", {
        header: "Assigned",
        cell: (c) => <span className="text-slate-500">{fmtDate(c.getValue())}</span>,
      }),
      col.accessor("taskName", {
        header: "Task Name",
        cell: (c) => (
          <span className="font-medium text-slate-900">{c.getValue()}</span>
        ),
      }),
      col.accessor((r) => r.owner?.name ?? "—", {
        id: "owner",
        header: "Owner",
        cell: (c) => <span className="text-slate-700">{c.getValue()}</span>,
      }),
      col.accessor((r) => r.mailbox?.displayName ?? "—", {
        id: "mailbox",
        header: "Source",
        cell: (c) => (
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
            {c.getValue()}
          </span>
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
      col.accessor("lastUpdated", {
        header: "Last Updated",
        cell: (c) => (
          <span className="text-slate-500">{fmtDateTime(c.getValue())}</span>
        ),
      }),
      col.accessor("dueDate", {
        header: "Due Date",
        cell: (c) => {
          const row = c.row.original;
          return (
            <span className={row.isOverdue ? "font-medium text-rose-600" : "text-slate-700"}>
              {fmtDate(c.getValue())}
            </span>
          );
        },
      }),
      col.accessor("latestNotes", {
        header: "Latest Notes",
        enableSorting: false,
        cell: (c) => (
          <span className="line-clamp-2 max-w-[16rem] text-slate-600" title={c.getValue() ?? ""}>
            {c.getValue() || "—"}
          </span>
        ),
      }),
      col.display({
        id: "sourceEmail",
        header: "Source Email",
        cell: (c) => {
          const n = c.row.original._count?.matchedEmails ?? 0;
          return n > 0 ? (
            <button
              onClick={() => setEmailTask(c.row.original)}
              className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200 hover:bg-violet-200"
            >
              {n} email{n > 1 ? "s" : ""}
            </button>
          ) : (
            <span className="text-slate-400">—</span>
          );
        },
      }),
      col.display({
        id: "actions",
        header: "",
        cell: (c) => {
          const t = c.row.original;
          const mode = canEditRow(t);
          return (
            <div className="flex items-center justify-end gap-1 whitespace-nowrap">
              {mode && (
                <button
                  onClick={() => {
                    setFormMode(mode);
                    setFormTask(t);
                  }}
                  className="rounded-md px-2 py-1 text-xs font-medium text-brand-700 hover:bg-brand-50"
                >
                  {mode === "notes" ? "Add Note" : "Edit"}
                </button>
              )}
              <button
                onClick={() => setHistoryTask(t)}
                className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                History
              </button>
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
    setFStatus("");
    setFOwner("");
    setFMailbox("");
    setFPriority("");
    setFOverdue(false);
    setFSearch("");
  };
  const anyFilter = fStatus || fOwner || fMailbox || fPriority || fOverdue || fSearch;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Marketing Tasks</h1>
          <p className="text-sm text-slate-500">
            {loading ? "Loading…" : `${tasks.length} task${tasks.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {perms.canCreate && (
          <button
            onClick={() => {
              setFormMode("full");
              setFormTask("new");
            }}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            + Add Task
          </button>
        )}
      </div>

      {/* View switcher (My Tasks / My Team / CMO Tracker / All) */}
      {views.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {views.map((v) => (
            <button
              key={v.key}
              onClick={() => setView(v.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                view === v.key
                  ? "bg-brand-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      )}

      {/* Filters (spec §10) */}
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <input
          value={fSearch}
          onChange={(e) => setFSearch(e.target.value)}
          placeholder="Search name, code, notes…"
          className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <select
          value={fStatus}
          onChange={(e) => setFStatus(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none"
        >
          <option value="">All statuses</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={fOwner}
          onChange={(e) => setFOwner(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none"
        >
          <option value="">All owners</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select
          value={fMailbox}
          onChange={(e) => setFMailbox(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none"
        >
          <option value="">All sources</option>
          {mailboxes.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </select>
        <select
          value={fPriority}
          onChange={(e) => setFPriority(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none"
        >
          <option value="">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={fOverdue}
            onChange={(e) => setFOverdue(e.target.checked)}
          />
          Overdue
        </label>
        {anyFilter ? (
          <button
            onClick={clearFilters}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:text-slate-800"
          >
            Clear
          </button>
        ) : null}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    onClick={h.column.getToggleSortingHandler()}
                    className={`whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                      h.column.getCanSort() ? "cursor-pointer select-none" : ""
                    }`}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {{ asc: " ▲", desc: " ▼" }[h.column.getIsSorted() as string] ?? ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2.5 align-top">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {!loading && tasks.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-10 text-center text-slate-400">
                  No tasks match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {formTask && (
        <TaskForm
          task={formTask === "new" ? null : formTask}
          mode={formMode ?? "full"}
          users={users}
          onClose={() => setFormTask(null)}
          onSaved={() => {
            setFormTask(null);
            fetchTasks();
          }}
        />
      )}
      {historyTask && (
        <HistoryModal task={historyTask} onClose={() => setHistoryTask(null)} />
      )}
      {emailTask && (
        <EmailUpdatesModal task={emailTask} onClose={() => setEmailTask(null)} />
      )}
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
  const [taskName, setTaskName] = useState(task?.taskName ?? "");
  const [ownerId, setOwnerId] = useState(task?.ownerId ?? "");
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
            ownerId: ownerId || null,
            status,
            priority,
            dueDate: dueDate ? new Date(dueDate).toISOString() : null,
            latestNotes,
          };
      const res = await fetch(
        isNew ? "/api/tasks" : `/api/tasks/${task!.id}`,
        {
          method: isNew ? "POST" : "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error ?? "Save failed");
      }
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const title = isNew ? "Add Task" : notesOnly ? "Add Note" : `Edit ${task!.taskCode}`;

  return (
    <Modal open onClose={onClose} title={title}>
      {err && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>
      )}
      <div className="space-y-4">
        {!notesOnly && (
          <>
            <Field label="Task name">
              <input
                value={taskName}
                onChange={(e) => setTaskName(e.target.value)}
                className={inputCls}
                placeholder="e.g. Launch Q3 webinar"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Owner">
                <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)} className={inputCls}>
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Priority">
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className={inputCls}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Status">
                <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
                  {TASK_STATUSES.filter((s) => s !== "Overdue").map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Due date">
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls} />
              </Field>
            </div>
          </>
        )}
        <Field label="Notes">
          <textarea
            value={latestNotes}
            onChange={(e) => setLatestNotes(e.target.value)}
            rows={3}
            className={inputCls}
            placeholder="Latest update / context…"
          />
        </Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={saving || (!notesOnly && !taskName.trim())}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
function HistoryModal({ task, onClose }: { task: TaskRow; onClose: () => void }) {
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  useEffect(() => {
    fetch(`/api/tasks/${task.id}/history`)
      .then((r) => r.json())
      .then((d) => setRows(d.history))
      .catch(() => setRows([]));
  }, [task.id]);

  return (
    <Modal open onClose={onClose} title={`History · ${task.taskCode}`} wide>
      {!rows ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No history yet.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-slate-200 pl-5">
          {rows.map((h) => (
            <li key={h.id} className="relative">
              <span className="absolute -left-[1.42rem] top-1 h-2.5 w-2.5 rounded-full bg-brand-500 ring-4 ring-white" />
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className={`rounded-full px-1.5 py-0.5 font-medium ${sourceStyle(h.sourceType)}`}>
                  {h.sourceType}
                </span>
                <span>{fmtDateTime(h.createdAt)}</span>
                {h.changedBy && <span>· {h.changedBy.name}</span>}
              </div>
              <div className="mt-1 text-sm text-slate-800">
                {h.newStatus && (
                  <div>
                    Status:{" "}
                    {h.previousStatus && <span className="text-slate-400">{h.previousStatus} → </span>}
                    <span className="font-medium">{h.newStatus}</span>
                  </div>
                )}
                {h.newDueDate && (
                  <div>
                    Due:{" "}
                    {h.previousDueDate && (
                      <span className="text-slate-400">{fmtDate(h.previousDueDate)} → </span>
                    )}
                    <span className="font-medium">{fmtDate(h.newDueDate)}</span>
                  </div>
                )}
                {h.notes && <div className="text-slate-600">{h.notes}</div>}
                {h.sourceEmail && (
                  <div className="mt-0.5 text-xs text-violet-600">
                    via email: {h.sourceEmail.subject} ({h.sourceEmail.fromEmail})
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
function EmailUpdatesModal({ task, onClose }: { task: TaskRow; onClose: () => void }) {
  const [rows, setRows] = useState<EmailUpdateRow[] | null>(null);
  useEffect(() => {
    fetch(`/api/tasks/${task.id}/email-updates`)
      .then((r) => r.json())
      .then((d) => setRows(d.emailUpdates))
      .catch(() => setRows([]));
  }, [task.id]);

  return (
    <Modal open onClose={onClose} title={`Linked emails · ${task.taskCode}`} wide>
      {!rows ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-500">No linked emails.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((e) => (
            <div key={e.id} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">{e.subject || "(no subject)"}</span>
                <span className="text-xs text-slate-400">{fmtDateTime(e.receivedAt)}</span>
              </div>
              <div className="text-xs text-slate-500">
                {e.fromName} &lt;{e.fromEmail}&gt; · {e.processingStatus}
                {e.matchConfidence != null && ` · ${e.matchConfidence}%`}
              </div>
              {e.extractedSummary && (
                <p className="mt-1 line-clamp-3 text-sm text-slate-600">{e.extractedSummary}</p>
              )}
              {e.attachments.length > 0 && (
                <div className="mt-1 text-xs text-slate-500">
                  📎 {e.attachments.map((a) => a.filename).join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

// --- small helpers ---
const inputCls =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function sourceStyle(s: string): string {
  if (s === "email") return "bg-violet-100 text-violet-700";
  if (s === "system") return "bg-slate-100 text-slate-600";
  return "bg-brand-50 text-brand-700";
}

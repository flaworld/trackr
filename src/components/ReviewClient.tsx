"use client";
import { useCallback, useEffect, useState } from "react";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { ConfidenceBadge, StatusBadge } from "./Badge";
import { Modal } from "./Modal";
import type { SuggestionRow, TaskRow } from "@/lib/types";

type Band = "" | "high" | "review" | "unmatched";

export function ReviewClient() {
  const [items, setItems] = useState<SuggestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [band, setBand] = useState<Band>("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linkFor, setLinkFor] = useState<SuggestionRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/email-updates/review${band ? `?band=${band}` : ""}`,
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
      const res = await fetch(`/api/email-updates/${id}/${action}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Action failed");
      setItems((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Review Queue</h1>
          <p className="text-sm text-slate-500">
            {loading ? "Loading…" : `${items.length} pending suggestion${items.length === 1 ? "" : "s"}`}
            {" · approve to apply to the tracker"}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {(
            [
              ["", "All"],
              ["high", "High confidence"],
              ["review", "Needs review"],
              ["unmatched", "Unmatched"],
            ] as [Band, string][]
          ).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setBand(v)}
              className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                band === v ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {!loading && items.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center text-slate-400">
          🎉 Nothing to review. Forward an email to the mailbox (or run{" "}
          <code className="text-slate-600">npm run seed-email</code>) to populate this queue.
        </div>
      )}

      <div className="grid gap-4">
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

      {linkFor && (
        <LinkTaskModal
          suggestion={linkFor}
          onClose={() => setLinkFor(null)}
          onDone={() => {
            setLinkFor(null);
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
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-medium text-slate-900">
              {e.subject || "(no subject)"}
            </h3>
            <ConfidenceBadge score={s.confidenceScore} />
          </div>
          <p className="mt-0.5 text-xs text-slate-500">
            {e.fromName ? `${e.fromName} ` : ""}&lt;{e.fromEmail}&gt; · received {fmtDateTime(e.receivedAt)}
            {e.mailbox && (
              <span className="ml-2 inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
                {e.mailbox.displayName}
              </span>
            )}
          </p>
        </div>
      </div>

      <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
        {/* Suggested update */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Suggested update
          </p>
          <dl className="space-y-1.5 text-sm">
            <Row label="Task">
              {s.task ? (
                <span>
                  <span className="font-mono text-xs text-slate-500">{s.task.taskCode}</span>{" "}
                  {s.task.taskName}
                </span>
              ) : (
                <span className="font-medium text-rose-600">Unmatched — link a task first</span>
              )}
            </Row>
            <Row label="Status">
              {s.suggestedStatus ? <StatusBadge status={s.suggestedStatus} /> : <Dash />}
            </Row>
            <Row label="Due date">
              {s.suggestedDueDate ? fmtDate(s.suggestedDueDate) : <Dash />}
            </Row>
            <Row label="Notes">
              <span className="text-slate-600">{s.suggestedNotes || "—"}</span>
            </Row>
            {s.reason && (
              <Row label="Why">
                <span className="text-xs italic text-slate-500">{s.reason}</span>
              </Row>
            )}
          </dl>
        </div>

        {/* Email preview */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Original email
          </p>
          <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
            <p className={showBody ? "" : "line-clamp-4 whitespace-pre-wrap"}>
              {e.bodyText || "(empty body)"}
            </p>
            {(e.bodyText?.length ?? 0) > 160 && (
              <button
                onClick={() => setShowBody((v) => !v)}
                className="mt-1 text-xs font-medium text-brand-600"
              >
                {showBody ? "Show less" : "Show more"}
              </button>
            )}
          </div>
          {e.attachments.length > 0 && (
            <div className="mt-2 text-xs text-slate-500">
              📎 {e.attachments.map((a) => a.filename || "attachment").join(", ")}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
        <button
          onClick={onLink}
          disabled={busy}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          Link / create task
        </button>
        <button
          onClick={onReject}
          disabled={busy}
          className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Reject
        </button>
        <button
          onClick={onApprove}
          disabled={busy || !canApprove}
          title={canApprove ? "" : "Link a task before approving"}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Working…" : "Approve & apply"}
        </button>
      </div>
    </div>
  );
}

function LinkTaskModal({
  suggestion,
  onClose,
  onDone,
}: {
  suggestion: SuggestionRow;
  onClose: () => void;
  onDone: () => void;
}) {
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [taskId, setTaskId] = useState("");
  const [newName, setNewName] = useState(
    suggestion.emailUpdate.subject?.replace(/^(re|fwd|fw):\s*/i, "") ?? "",
  );
  const [tab, setTab] = useState<"link" | "create">("link");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/tasks", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setTasks(d.tasks))
      .catch(() => setTasks([]));
  }, []);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const body =
        tab === "create"
          ? { createNew: true, taskName: newName }
          : { taskId };
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
    <Modal open onClose={onClose} title="Link or create task">
      {err && <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</div>}
      <div className="mb-4 flex gap-1 rounded-lg border border-slate-200 p-1">
        <button
          onClick={() => setTab("link")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${tab === "link" ? "bg-brand-50 text-brand-700" : "text-slate-600"}`}
        >
          Link existing
        </button>
        <button
          onClick={() => setTab("create")}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium ${tab === "create" ? "bg-brand-50 text-brand-700" : "text-slate-600"}`}
        >
          Create new
        </button>
      </div>

      {tab === "link" ? (
        <select
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Select a task…</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.taskCode} — {t.taskName}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New task name"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
      )}

      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
          Cancel
        </button>
        <button
          onClick={submit}
          disabled={busy || (tab === "link" ? !taskId : !newName.trim())}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "Saving…" : tab === "create" ? "Create & link" : "Link"}
        </button>
      </div>
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-20 shrink-0 text-slate-400">{label}</dt>
      <dd className="min-w-0 flex-1 text-slate-800">{children}</dd>
    </div>
  );
}
function Dash() {
  return <span className="text-slate-400">—</span>;
}

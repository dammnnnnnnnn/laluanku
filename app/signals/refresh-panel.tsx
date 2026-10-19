"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Strings } from "@/lib/i18n";
import type { RefreshSummary } from "@/lib/signals/refresh";

type State =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "done"; summary: RefreshSummary }
  | { kind: "error"; message: string };

export function RefreshPanel({ s }: { s: Strings }) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });

  async function refresh(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "running" });
    try {
      const res = await fetch("/api/signals/refresh", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      const body = await res.json();
      if (!res.ok) {
        setState({ kind: "error", message: body.error ?? `HTTP ${res.status}` });
        return;
      }
      setState({ kind: "done", summary: body as RefreshSummary });
      router.refresh();
    } catch (err) {
      setState({ kind: "error", message: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="font-semibold">{s.refreshTitle}</h2>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{s.refreshHelp}</p>
      <form onSubmit={refresh} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="admin-token">
          {s.refreshToken}
        </label>
        <input
          id="admin-token"
          type="password"
          autoComplete="off"
          placeholder={s.refreshToken}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          className="flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={!token || state.kind === "running"}
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {s.refreshButton}
        </button>
      </form>

      {state.kind === "running" && <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{s.refreshRunning}</p>}
      {state.kind === "error" && <p className="mt-3 text-sm text-red-700 dark:text-red-400">{state.message}</p>}
      {state.kind === "done" && (
        <div className="mt-3 text-sm">
          <p className="font-medium">
            {s.refreshDone} ({state.summary.tagger}
            {state.summary.model ? ` · ${state.summary.model}` : ""}): {state.summary.checked} {s.refreshChecked},{" "}
            {state.summary.accepted} {s.refreshAccepted}, {state.summary.rejected} {s.refreshRejected}, {state.summary.failed}{" "}
            {s.refreshFailedItems}
          </p>
          {state.summary.feeds
            .filter((f) => !f.ok)
            .map((f) => (
              <p key={f.key} className="text-amber-700 dark:text-amber-400">
                {f.name}: {s.refreshFeedFailed} ({f.error})
              </p>
            ))}
          {state.summary.newSignals.length > 0 && (
            <ul className="mt-2 list-disc pl-5">
              {state.summary.newSignals.map((n) => (
                <li key={n.id}>
                  {n.direction === "emerging" ? "↑" : "↓"} {n.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

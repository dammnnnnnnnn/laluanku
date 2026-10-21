"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Strings } from "@/lib/i18n";
import type { RefreshSummary } from "@/lib/signals/refresh";
import { btnPrimary, inputClass } from "../ui";

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
    <section className="card flex flex-col gap-3">
      <h2 className="text-[17px] font-semibold">{s.refreshTitle}</h2>
      <p className="text-sm text-mu">{s.refreshHelp}</p>
      <form onSubmit={refresh} className="flex flex-col gap-2 sm:flex-row">
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
          className={`${inputClass} flex-1`}
        />
        <button
          type="submit"
          disabled={!token || state.kind === "running"}
          className={btnPrimary}
        >
          {s.refreshButton}
        </button>
      </form>

      {state.kind === "running" && <p className="text-sm text-mu">{s.refreshRunning}</p>}
      {state.kind === "error" && <p className="rounded-xl bg-dnbg px-3.5 py-2.5 text-sm text-dn">{state.message}</p>}
      {state.kind === "done" && (
        <div className="rounded-xl bg-sf2 px-3.5 py-3 text-sm">
          <p className="font-medium">
            {s.refreshDone} ({state.summary.tagger}
            {state.summary.model ? ` · ${state.summary.model}` : ""}): {state.summary.checked} {s.refreshChecked},{" "}
            {state.summary.accepted} {s.refreshAccepted}, {state.summary.rejected} {s.refreshRejected}, {state.summary.failed}{" "}
            {s.refreshFailedItems}
          </p>
          {state.summary.feeds
            .filter((f) => !f.ok)
            .map((f) => (
              <p key={f.key} className="text-am">
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

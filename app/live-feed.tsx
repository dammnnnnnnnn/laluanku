"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Strings } from "@/lib/i18n";
import type { HomeSignal } from "@/lib/home";
import { Badge } from "./ui";

const ROTATE_MS = 6000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthYear = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
// "WEF Future of Jobs Report 2025" → "WEF"; "Google News (…)" → "Google News"
const shortSource = (name: string) => {
  const head = name.split(/ \(|: |, via /)[0];
  return head.length > 18 ? head.split(" ")[0] : head;
};
const clockFmt = new Intl.DateTimeFormat("en-MY", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Kuala_Lumpur" });

function ago(from: Date, now: number): string {
  const min = Math.max(0, Math.round((now - from.getTime()) / 60000));
  if (min < 60) return `${min}m`;
  if (min < 48 * 60) return `${Math.round(min / 60)}h`;
  return `${Math.round(min / 1440)}d`;
}

/** The hero card: cycles through the newest signals, with counts and time since the last fetch. */
export function LiveFeed({ s, feed, total, newThisWeek, lastFetched }: { s: Strings; feed: HomeSignal[]; total: number; newThisWeek: number; lastFetched: string | null }) {
  const [i, setI] = useState(0);
  const [now, setNow] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const update = () => {
      const elapsed = Date.now() - start;
      setNow(Date.now());
      setI(Math.floor(elapsed / ROTATE_MS) % Math.max(1, feed.length));
      setProgress((elapsed % ROTATE_MS) / ROTATE_MS);
    };
    const first = setTimeout(update, 0); // the clock and "since last fetch" show right after hydration
    const tick = setInterval(update, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(tick);
    };
  }, [feed.length]);

  if (feed.length === 0) return null;
  const live = feed[i];
  const next = [1, 2, 3].map((k) => feed[(i + k) % feed.length]).filter((x) => x.id !== live.id);

  return (
    <div className="flex flex-col gap-4 rounded-3xl border border-ln bg-sf p-6 shadow-card">
      <div className="flex items-center gap-2.5">
        <span className="size-2.5 rounded-full bg-up shadow-[0_0_0_4px_var(--upbg)]" aria-hidden />
        <b className="font-mono text-xs font-semibold tracking-[0.06em] uppercase">{s.liveFeed}</b>
        <span className="ml-auto font-mono text-xs text-mu" suppressHydrationWarning>
          {now ? `${clockFmt.format(now)} MYT` : ""}
        </span>
      </div>

      <div className="flex min-h-[172px] flex-col gap-3 rounded-2xl bg-sf2 p-5" aria-live="polite">
        <div className="flex items-center gap-2">
          <Badge tone={live.direction === "emerging" ? "up" : "dn"}>{live.direction === "emerging" ? `↑ ${s.signalsEmerging}` : `↓ ${s.signalsDeclining}`}</Badge>
          <span className="ml-auto font-mono text-xs text-mu">
            {shortSource(live.sourceName)} · {monthYear(live.publishedDate)}
          </span>
        </div>
        <p className="text-[19px] leading-snug font-semibold tracking-[-0.01em] text-pretty">{live.title}</p>
        {live.roles.length > 0 && (
          <div className="mt-auto text-[13px] text-mu">
            {s.liveAffects}: <b className="font-medium text-ink">{live.roles.slice(0, 2).join(", ")}</b>
          </div>
        )}
        <div className="h-[3px] overflow-hidden rounded bg-ln">
          <div className="h-full bg-pr transition-[width] duration-1000 ease-linear" style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      </div>

      {next.length > 0 && (
        <div>
          <div className="mb-1 font-mono text-xs font-semibold tracking-[0.06em] text-mu uppercase">{s.liveUpNext}</div>
          {next.map((n) => (
            <div key={n.id} className="flex items-center gap-2.5 border-t border-ln py-2.5 text-sm">
              <b className={`w-3.5 ${n.direction === "emerging" ? "text-up" : "text-dn"}`}>{n.direction === "emerging" ? "↑" : "↓"}</b>
              <span className="min-w-0 flex-1 truncate">{n.title}</span>
              <span className="font-mono text-xs whitespace-nowrap text-mu">
                {shortSource(n.sourceName)} · {monthYear(n.publishedDate)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-sf2 p-3">
          <b className="text-xl">{total}</b>
          <div className="text-xs text-mu">{s.liveSignals}</div>
        </div>
        <div className="rounded-2xl bg-upbg p-3 text-up">
          <b className="text-xl">+{newThisWeek}</b>
          <div className="text-xs">{s.liveThisWeek}</div>
        </div>
        <div className="rounded-2xl bg-sf2 p-3">
          <b className="text-xl" suppressHydrationWarning>
            {lastFetched && now ? ago(new Date(lastFetched), now) : "–"}
          </b>
          <div className="text-xs text-mu">{s.liveSinceRefresh}</div>
        </div>
      </div>
      <Link href="/signals" className="text-sm font-semibold text-pr">
        {s.liveSeeAll} →
      </Link>
    </div>
  );
}

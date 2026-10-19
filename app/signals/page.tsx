import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { t, type Strings } from "@/lib/i18n";
import { getStrings } from "@/lib/locale";
import { getSignalsPageData, type SignalsPageData } from "@/lib/signals/queries";
import { DbError } from "../db-error";
import { RefreshPanel } from "./refresh-panel";

export const metadata = { title: "Trend signals · LaluanKu" };

const TZ = "Asia/Kuala_Lumpur";
const monthYear = new Intl.DateTimeFormat("en-MY", { month: "short", year: "numeric", timeZone: TZ });
const day = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
const dayTime = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ });

type Direction = "all" | "emerging" | "declining";

export default function SignalsPage({ searchParams }: PageProps<"/signals">) {
  const s = t("en");
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
      <Suspense fallback={<p className="text-sm text-zinc-500">{s.signalsLoading}</p>}>
        <SignalsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SignalsContent({ searchParams }: { searchParams: PageProps<"/signals">["searchParams"] }) {
  await connection();
  const { s, locale } = await getStrings();
  const header = (
    <header className="flex flex-col gap-2">
      <h1 className="text-3xl font-semibold tracking-tight">{s.signalsTitle}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{s.signalsIntro}</p>
    </header>
  );
  const params = await searchParams;
  const direction: Direction = params.direction === "emerging" || params.direction === "declining" ? params.direction : "all";

  let data: SignalsPageData;
  try {
    data = await getSignalsPageData(getDb());
  } catch (err) {
    return (
      <div lang={locale} className="flex flex-col gap-6">
        {header}
        <DbError s={s} err={err} where="signals page" />
        <RefreshPanel s={s} />
      </div>
    );
  }

  const shown = direction === "all" ? data.signals : data.signals.filter((x) => x.direction === direction);
  const latestRun = data.runs[0];

  return (
    <div lang={locale} className="flex flex-col gap-6">
      {header}
      <StatusBar s={s} data={data} />
      <nav className="flex flex-wrap items-center gap-2 text-sm" aria-label="Filter signals">
        {(["all", "emerging", "declining"] as const).map((d) => (
          <Link
            key={d}
            href={d === "all" ? "/signals" : `/signals?direction=${d}`}
            className={`rounded-full border px-3 py-1 ${d === direction ? "border-emerald-700 bg-emerald-700 text-white" : "border-zinc-300 dark:border-zinc-700"}`}
          >
            {d === "all" ? s.signalsAll : d === "emerging" ? `↑ ${s.signalsEmerging}` : `↓ ${s.signalsDeclining}`}
          </Link>
        ))}
        <span className="ml-auto text-zinc-500">
          {shown.length} {s.signalsCount}
        </span>
      </nav>

      <ul className="flex flex-col gap-3">
        {shown.map((sig) => (
          <SignalCard key={sig.id} s={s} sig={sig} />
        ))}
      </ul>

      <p className="text-xs text-zinc-500">{s.signalsStrengthNote}</p>

      {data.runs.length > 0 && (
        <section className="text-sm">
          <h2 className="mb-2 font-semibold">{s.refreshRecentRuns}</h2>
          <ul className="flex flex-col gap-1 text-zinc-600 dark:text-zinc-400">
            {data.runs.map((run) => (
              <li key={run.id}>
                {dayTime.format(run.startedAt)} · {run.status} · {run.tagger}
                {run.model ? ` (${run.model})` : ""} · {run.checked} {s.refreshChecked}, {run.accepted} {s.refreshAccepted}
                {run.feeds.some((f) => !f.ok) && (
                  <span className="text-amber-700 dark:text-amber-400">
                    {" "}
                    · {s.refreshFeedFailed}: {run.feeds.filter((f) => !f.ok).map((f) => f.key).join(", ")}
                  </span>
                )}
              </li>
            ))}
          </ul>
          {latestRun?.status === "failed" && <p className="mt-2 text-amber-700 dark:text-amber-400">{s.signalsRefreshFailed}</p>}
        </section>
      )}
      <RefreshPanel s={s} />
    </div>
  );
}

function StatusBar({ s, data }: { s: Strings; data: SignalsPageData }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-900 sm:flex-row sm:gap-6">
      <span>
        <strong>{s.signalsLastUpdated}:</strong> {data.lastFetched ? dayTime.format(data.lastFetched) : "–"}
      </span>
      <span>
        <strong>{s.signalsLastRefresh}:</strong>{" "}
        {data.lastGoodRun?.finishedAt ? `${dayTime.format(data.lastGoodRun.finishedAt)} (${data.lastGoodRun.status})` : s.signalsNoRefresh}
      </span>
    </div>
  );
}

const TAGGER_STYLE = {
  curated: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  claude: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
  keyword: "bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200",
} as const;

function SignalCard({ s, sig }: { s: Strings; sig: SignalsPageData["signals"][number] }) {
  const published = new Date(`${sig.publishedDate}T00:00:00+08:00`);
  const taggerLabel = sig.taggedBy === "curated" ? s.taggedCurated : sig.taggedBy === "claude" ? s.taggedClaude : s.taggedKeyword;
  const emerging = sig.direction === "emerging";

  return (
    <li className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`rounded px-2 py-0.5 font-medium ${emerging ? "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200" : "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200"}`}
        >
          {emerging ? `↑ ${s.signalsEmerging}` : `↓ ${s.signalsDeclining}`}
        </span>
        <span className="rounded border border-zinc-300 px-2 py-0.5 dark:border-zinc-700">
          {sig.sourceName} · {monthYear.format(published)}
        </span>
        <span className="rounded bg-zinc-100 px-2 py-0.5 capitalize dark:bg-zinc-900">{sig.sourceType}</span>
        <span className={`rounded px-2 py-0.5 ${TAGGER_STYLE[sig.taggedBy]}`}>{taggerLabel}</span>
        <span className="ml-auto text-zinc-500" title={`${s.signalsStrength} ${sig.strength}/5`}>
          {s.signalsStrength} {"●".repeat(sig.strength)}
          {"○".repeat(5 - sig.strength)}
        </span>
      </div>
      <h3 className="mt-2 font-medium">{sig.title}</h3>
      {sig.summary !== sig.title && <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{sig.summary}</p>}
      {(sig.roles.length > 0 || sig.skills.length > 0) && (
        <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
          {sig.roles.length > 0 && (
            <>
              <strong>{s.signalsRoles}:</strong> {sig.roles.join(", ")}
            </>
          )}
          {sig.roles.length > 0 && sig.skills.length > 0 && " · "}
          {sig.skills.length > 0 && (
            <>
              <strong>{s.signalsSkills}:</strong> {sig.skills.join(", ")}
            </>
          )}
        </p>
      )}
      <p className="mt-2 flex flex-wrap gap-x-4 text-xs text-zinc-500">
        <span>
          {s.signalsPublished}: {day.format(published)}
        </span>
        <span>
          {s.signalsFetched}: {dayTime.format(sig.fetchedAt)}
        </span>
        <a href={sig.url} target="_blank" rel="noopener noreferrer" className="text-emerald-700 underline dark:text-emerald-400">
          {s.signalsOpenSource}
        </a>
      </p>
    </li>
  );
}

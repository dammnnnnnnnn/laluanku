import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { t, type Strings } from "@/lib/i18n";
import { getStrings } from "@/lib/locale";
import { getSignalsPageData, type SignalsPageData } from "@/lib/signals/queries";
import { DbError } from "../db-error";
import { Badge, PageBody, PageHero } from "../ui";
import { RefreshPanel } from "./refresh-panel";

export const metadata = { title: "Trend signals · LaluanKu" };

const TZ = "Asia/Kuala_Lumpur";
const monthYear = new Intl.DateTimeFormat("en-MY", { month: "short", year: "numeric", timeZone: TZ });
const day = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: TZ });
const dayTime = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ });

type Direction = "all" | "emerging" | "declining";

export default function SignalsPage({ searchParams }: PageProps<"/signals">) {
  const s = t("en");
  return (
    <main className="flex flex-1 flex-col">
      <Suspense
        fallback={
          <PageHero eyebrow={s.signalsTitle} title={s.signalsHeading} intro={s.signalsIntro}>
            <p className="mt-4 text-sm text-mu">{s.signalsLoading}</p>
          </PageHero>
        }
      >
        <SignalsContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function SignalsContent({ searchParams }: { searchParams: PageProps<"/signals">["searchParams"] }) {
  await connection();
  const { s, locale } = await getStrings();
  const params = await searchParams;
  const direction: Direction = params.direction === "emerging" || params.direction === "declining" ? params.direction : "all";

  let data: SignalsPageData;
  try {
    data = await getSignalsPageData(getDb());
  } catch (err) {
    return (
      <div lang={locale}>
        <PageHero eyebrow={s.signalsTitle} title={s.signalsHeading} intro={s.signalsIntro} />
        <PageBody className="flex flex-col gap-6">
          <DbError s={s} err={err} where="signals page" />
          <RefreshPanel s={s} />
        </PageBody>
      </div>
    );
  }

  const shown = direction === "all" ? data.signals : data.signals.filter((x) => x.direction === direction);
  const latestRun = data.runs[0];

  return (
    <div lang={locale}>
      <PageHero eyebrow={s.signalsTitle} title={s.signalsHeading} intro={s.signalsIntro} aside={<StatusBoxes s={s} data={data} />} />

      <PageBody className="flex flex-col gap-5">
        <nav className="flex flex-wrap items-center gap-3" aria-label="Filter signals">
          <div className="flex gap-1 rounded-xl border border-ln bg-sf2 p-1">
            {(["all", "emerging", "declining"] as const).map((d) => (
              <Link
                key={d}
                href={d === "all" ? "/signals" : `/signals?direction=${d}`}
                aria-current={d === direction ? "page" : undefined}
                className={`rounded-[9px] px-4 py-2 text-sm font-semibold ${d === direction ? "bg-pr text-pri" : "bg-sf text-ink hover:text-pr"}`}
              >
                {d === "all" ? s.signalsAll : d === "emerging" ? `↑ ${s.signalsEmerging}` : `↓ ${s.signalsDeclining}`}
              </Link>
            ))}
          </div>
          <span className="ml-auto text-sm text-mu">
            {shown.length} {s.signalsCount}
          </span>
        </nav>

        <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-4">
          {shown.map((sig) => (
            <SignalCard key={sig.id} s={s} sig={sig} />
          ))}
        </ul>

        <p className="text-[13px] leading-normal text-mu">{s.signalsStrengthNote}</p>

        {data.runs.length > 0 && (
          <section className="card flex flex-col gap-3 text-sm">
            <h2 className="text-[17px] font-semibold">{s.refreshRecentRuns}</h2>
            <ul className="flex flex-col">
              {data.runs.map((run) => {
                const failedFeeds = run.feeds.filter((f) => !f.ok);
                return (
                  <li key={run.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ln py-2.5 first:border-t-0">
                    <span className="font-mono text-xs text-mu">{dayTime.format(run.startedAt)}</span>
                    <Badge tone={run.status === "ok" ? "up" : run.status === "failed" ? "dn" : "am"}>{run.status}</Badge>
                    <span className="text-mu">
                      {run.tagger}
                      {run.model ? ` (${run.model})` : ""} · {run.checked} {s.refreshChecked}, {run.accepted} {s.refreshAccepted}
                    </span>
                    {failedFeeds.length > 0 && (
                      <span className="text-am">
                        {s.refreshFeedFailed}: {failedFeeds.map((f) => f.key).join(", ")}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            {latestRun?.status === "failed" && <p className="text-am">{s.signalsRefreshFailed}</p>}
          </section>
        )}
        <RefreshPanel s={s} />
      </PageBody>
    </div>
  );
}

function StatusBoxes({ s, data }: { s: Strings; data: SignalsPageData }) {
  const run = data.lastGoodRun;
  return (
    <div className="flex flex-wrap gap-3">
      <div className="rounded-2xl border border-ln bg-sf px-[18px] py-3.5">
        <div className="font-mono text-xs font-semibold tracking-[0.06em] text-mu uppercase">{s.signalsLastUpdated}</div>
        <b className="text-[15px] font-semibold">{data.lastFetched ? dayTime.format(data.lastFetched) : "–"}</b>
      </div>
      <div className="rounded-2xl border border-ln bg-sf px-[18px] py-3.5">
        <div className="font-mono text-xs font-semibold tracking-[0.06em] text-mu uppercase">{s.signalsLastRefresh}</div>
        {run?.finishedAt ? (
          <b className={`text-[15px] font-semibold ${run.status === "ok" ? "text-up" : "text-am"}`} title={dayTime.format(run.finishedAt)}>
            ● {run.status.toUpperCase()} · {run.accepted} {s.refreshAccepted}
          </b>
        ) : (
          <b className="block max-w-[220px] text-[13px] leading-snug font-medium text-mu">{s.signalsNoRefresh}</b>
        )}
      </div>
    </div>
  );
}

const TAGGER_TONE = { curated: "up", claude: "pr", keyword: "neutral" } as const;

function SignalCard({ s, sig }: { s: Strings; sig: SignalsPageData["signals"][number] }) {
  const published = new Date(`${sig.publishedDate}T00:00:00+08:00`);
  const taggerLabel = sig.taggedBy === "curated" ? s.taggedCurated : sig.taggedBy === "claude" ? s.taggedClaude : s.taggedKeyword;
  const emerging = sig.direction === "emerging";
  // "Hays Asia Salary Guide 2025, via People Matters" → "Hays Asia Salary Guide 2025"
  const source = sig.sourceName.split(/ \(|, via /)[0];

  return (
    <li className="card flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={emerging ? "info" : "dn"}>{emerging ? `↑ ${s.signalsEmerging}` : `↓ ${s.signalsDeclining}`}</Badge>
        <Badge tone={TAGGER_TONE[sig.taggedBy]} className={sig.taggedBy === "keyword" ? "text-mu" : ""}>
          {taggerLabel}
        </Badge>
        <Badge className="capitalize">{sig.sourceType}</Badge>
        <span className="ml-auto tracking-[2px] text-pr" title={`${s.signalsStrength} ${sig.strength}/5`}>
          <span className="sr-only">
            {s.signalsStrength} {sig.strength}/5
          </span>
          <span aria-hidden>
            {"●".repeat(sig.strength)}
            {"○".repeat(5 - sig.strength)}
          </span>
        </span>
      </div>
      <h3 className="text-lg leading-snug font-semibold">{sig.title}</h3>
      {sig.summary !== sig.title && <p className="line-clamp-3 text-sm leading-normal text-mu">{sig.summary}</p>}
      {(sig.roles.length > 0 || sig.skills.length > 0) && (
        <div className="flex flex-col gap-1 text-sm leading-snug text-mu">
          {sig.roles.length > 0 && (
            <p>
              <b className="font-semibold text-ink">{s.signalsRoles}:</b> {sig.roles.join(", ")}
            </p>
          )}
          {sig.skills.length > 0 && (
            <p>
              <b className="font-semibold text-ink">{s.signalsSkills}:</b> {sig.skills.join(", ")}
            </p>
          )}
        </div>
      )}
      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ln pt-3 text-[13px] text-mu">
        <span className="font-mono" title={`${s.signalsPublished}: ${day.format(published)}`}>
          {source} · {monthYear.format(published)}
        </span>
        <span className="font-mono text-xs">
          {s.signalsFetched} {dayTime.format(sig.fetchedAt)}
        </span>
        <a href={sig.url} target="_blank" rel="noopener noreferrer" className="ml-auto font-semibold text-pr">
          {s.signalsOpenSource} ↗
        </a>
      </div>
    </li>
  );
}

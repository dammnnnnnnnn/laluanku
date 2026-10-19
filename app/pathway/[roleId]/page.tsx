import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { fmt, t, type Strings } from "@/lib/i18n";
import type { Cost } from "@/lib/pathway/engine";
import { loadPathway, type PathwayData } from "@/lib/pathway/load";
import { DEFAULT_SAMPLE } from "@/lib/scoring/results";
import { SDG_GOALS, SDG_TARGETS } from "@/lib/sdg";
import { DbError } from "../../db-error";
import { SdgChip } from "../../sdg-chip";

export const metadata = { title: "Learning pathway · LaluanKu" };

const COST_STYLE: Record<Cost, string> = {
  free: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
  low: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  hrdc_claimable: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
};

const costLabel = (s: Strings, c: Cost) => (c === "free" ? s.costFree : c === "low" ? s.costLow : s.costHrdc);

export default function PathwayPage({ params, searchParams }: PageProps<"/pathway/[roleId]">) {
  const s = t("en");
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-10 sm:px-6">
      <Suspense fallback={<p className="text-sm text-zinc-500">{s.resultsLoading}</p>}>
        <PathwayContent s={s} params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function PathwayContent({
  s,
  params,
  searchParams,
}: {
  s: Strings;
  params: PageProps<"/pathway/[roleId]">["params"];
  searchParams: PageProps<"/pathway/[roleId]">["searchParams"];
}) {
  await connection();
  const { roleId } = await params;
  const query = await searchParams;
  const profileRef = typeof query.profile === "string" && query.profile ? query.profile : DEFAULT_SAMPLE;

  let data: PathwayData | null;
  try {
    data = await loadPathway(getDb(), roleId, profileRef);
  } catch (err) {
    return <DbError s={s} err={err} where="pathway page" />;
  }
  if (!data) return <p className="text-sm">{s.resultsNoProfile}</p>;
  return <PathwayView s={s} data={data} />;
}

function PathwayView({ s, data }: { s: Strings; data: PathwayData }) {
  const { pathway, role, skillNames } = data;
  const backHref = `/results?profile=${encodeURIComponent(data.profile.ref)}`;

  return (
    <>
      <header className="flex flex-col gap-2">
        <Link href={backHref} className="text-sm text-emerald-700 underline dark:text-emerald-400">
          ← {s.pathwayBack}
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">{fmt(s.pathwayTitle, { role: role.title })}</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {fmt(s.pathwayFor, { name: data.profile.displayName, hours: data.profile.hoursPerWeek, budget: costLabel(s, data.profile.budget) })}
          {!data.profile.isSample && (
            <>
              {" "}
              <Link href="/intake" className="underline">
                {s.pathwayChangeProfile}
              </Link>
            </>
          )}
        </p>
        <div className="flex flex-wrap gap-1">
          {role.sdgIds.map((g) => (
            <SdgChip key={g} goal={g} />
          ))}
        </div>
      </header>

      {pathway.steps.length === 0 ? (
        <p className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">{s.pathwayNoGap}</p>
      ) : (
        <section className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <p className="text-lg font-semibold">
            {fmt(s.pathwayTotal, { hours: pathway.totalHours, weeks: pathway.totalWeeks, perWeek: pathway.hoursPerWeek })}
          </p>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">
            {fmt(s.pathwayCosts, { free: pathway.costCounts.free, low: pathway.costCounts.low, hrdc: pathway.costCounts.hrdc_claimable })}
          </p>
          <p className="mt-2 text-xs text-zinc-500">{s.pathwayRule}</p>
          <p className="mt-1 text-xs text-zinc-500">⚠ {s.pathwayEstimateNote}</p>
        </section>
      )}

      <ol className="flex flex-col gap-3">
        {pathway.steps.map((step) => (
          <li key={step.course.id} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-zinc-500">{fmt(s.pathwayStep, { n: step.order })}</span>
              <span className="text-zinc-500">
                {step.startWeek === step.endWeek ? fmt(s.pathwayWeek, { from: step.startWeek }) : fmt(s.pathwayWeeks, { from: step.startWeek, to: step.endWeek })}
              </span>
              <span className={`rounded px-2 py-0.5 ${COST_STYLE[step.course.cost]}`}>{costLabel(s, step.course.cost)}</span>
              <span className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-900">
                {step.course.hours} h{step.course.hoursEstimated ? "*" : ""}
              </span>
              <span className="uppercase text-zinc-500">{step.course.language}</span>
            </div>
            <h2 className="mt-2 font-semibold">{step.course.title}</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{step.course.provider}</p>
            <p className="mt-2 text-sm">
              <strong>{s.pathwayCovers}:</strong> {step.covers.map((id) => skillNames[id]).join(", ")}
            </p>
            {step.course.notes && <p className="mt-1 text-xs text-zinc-500">{step.course.notes}</p>}
            <a href={step.course.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-emerald-700 underline dark:text-emerald-400">
              {s.pathwayOpen} ↗
            </a>
            {step.alternatives.length > 0 && (
              <details className="mt-2 text-xs">
                <summary className="cursor-pointer text-zinc-600 dark:text-zinc-400">{s.pathwayAlternatives}</summary>
                <ul className="mt-1 flex flex-col gap-1">
                  {step.alternatives.map((a) => (
                    <li key={a.course.id}>
                      <a href={a.course.url} target="_blank" rel="noopener noreferrer" className="underline">
                        {a.course.title}
                      </a>{" "}
                      · {a.course.provider} · {costLabel(s, a.course.cost)} · {a.course.hours} h{a.course.hoursEstimated ? "*" : ""}
                      {!a.withinBudget && <span className="text-amber-700 dark:text-amber-400"> ({s.pathwayOverBudget})</span>}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ol>

      {pathway.overBudget.length > 0 && (
        <section className="rounded-lg border border-amber-300 p-4 text-sm dark:border-amber-800">
          <h2 className="font-semibold">{s.pathwayOverBudgetTitle}</h2>
          <ul className="mt-2 flex flex-col gap-1">
            {pathway.overBudget.map((o) => (
              <li key={o.skill.skillId}>
                {skillNames[o.skill.skillId]}:{" "}
                <a href={o.course.url} target="_blank" rel="noopener noreferrer" className="underline">
                  {o.course.title}
                </a>{" "}
                ({o.course.provider}, {costLabel(s, o.course.cost)}, {o.course.hours} h{o.course.hoursEstimated ? "*" : ""})
              </li>
            ))}
          </ul>
        </section>
      )}

      {(pathway.uncovered.length > 0 || pathway.practice.length > 0) && (
        <section className="grid gap-4 text-sm sm:grid-cols-2">
          {pathway.uncovered.length > 0 && (
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <h2 className="font-semibold">{s.pathwayUncoveredTitle}</h2>
              <p className="mt-1 text-xs text-zinc-500">{s.pathwayUncoveredText}</p>
              <p className="mt-2">{pathway.uncovered.map((u) => skillNames[u.skillId]).join(", ")}</p>
            </div>
          )}
          {pathway.practice.length > 0 && (
            <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
              <h2 className="font-semibold">{s.pathwayPracticeTitle}</h2>
              <p className="mt-1 text-xs text-zinc-500">{s.pathwayPracticeText}</p>
              <p className="mt-2">{pathway.practice.map((u) => skillNames[u.skillId]).join(", ")}</p>
            </div>
          )}
        </section>
      )}

      {data.schedule.length > 0 && (
        <section className="text-sm">
          <h2 className="text-xl font-semibold">{s.pathwayScheduleTitle}</h2>
          <ul className="mt-2 grid gap-1 sm:grid-cols-2">
            {data.schedule.map((w) => (
              <li key={w.week} className="flex gap-2 rounded border border-zinc-200 px-3 py-1.5 dark:border-zinc-800">
                <span className="w-16 shrink-0 text-zinc-500">{fmt(s.pathwayWeek, { from: w.week })}</span>
                <span>{w.steps.map((n) => pathway.steps[n - 1].course.title).join(" + ")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <h2 className="text-xl font-semibold">{s.pathwaySdgTitle}</h2>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">{s.pathwaySdgIntro}</p>
        <ul className="mt-3 flex flex-col gap-3">
          {data.contributions.map((c) => (
            <li key={c.target} className="flex flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
              <span className="shrink-0">
                <SdgChip goal={c.goal} compact title={`SDG ${c.goal}: ${SDG_GOALS[c.goal]?.en ?? ""}`} />{" "}
                <strong>Target {c.target}</strong>
              </span>
              <span>
                <span className="text-zinc-500">{SDG_TARGETS[c.target] ?? ""}.</span> {c.reason}
              </span>
            </li>
          ))}
        </ul>
        {data.skillGoals.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{s.pathwaySkillGoals}:</p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {data.skillGoals.map((g) => (
                <li key={g.goal}>
                  <SdgChip goal={g.goal} title={g.skills.join(", ")} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {data.coursesVerifiedAt && <p className="text-xs text-zinc-500">{fmt(s.pathwayVerified, { date: data.coursesVerifiedAt })}</p>}
    </>
  );
}

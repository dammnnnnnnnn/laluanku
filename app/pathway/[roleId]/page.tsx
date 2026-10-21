import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getDb } from "@/lib/db";
import { fmt, t, type Locale, type Strings } from "@/lib/i18n";
import { getStrings } from "@/lib/locale";
import type { Cost } from "@/lib/pathway/engine";
import { loadPathway, type PathwayData, type SdgContribution } from "@/lib/pathway/load";
import { DEFAULT_SAMPLE } from "@/lib/scoring/results";
import { SDG_GOALS, SDG_TARGETS } from "@/lib/sdg";
import { DbError } from "../../db-error";
import { SdgChip, SdgTarget } from "../../sdg-chip";
import { Badge, PageBody, PageHero } from "../../ui";

export const metadata = { title: "Learning pathway · LaluanKu" };

const COST_TONE = { free: "up", low: "am", hrdc_claimable: "info" } as const;
// One colour per course in the week bar, cycling if a path has more courses than colours.
const STEP_COLORS = ["bg-pr", "bg-pr/55", "bg-info", "bg-up", "bg-am"];

const costLabel = (s: Strings, c: Cost) => (c === "free" ? s.costFree : c === "low" ? s.costLow : s.costHrdc);

export default function PathwayPage({ params, searchParams }: PageProps<"/pathway/[roleId]">) {
  const s = t("en");
  return (
    <main className="flex flex-1 flex-col">
      <Suspense
        fallback={
          <PageHero eyebrow={s.pathwayEyebrow} title="…">
            <p className="mt-4 text-sm text-mu">{s.resultsLoading}</p>
          </PageHero>
        }
      >
        <PathwayContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function PathwayContent({
  params,
  searchParams,
}: {
  params: PageProps<"/pathway/[roleId]">["params"];
  searchParams: PageProps<"/pathway/[roleId]">["searchParams"];
}) {
  await connection();
  const { s, locale } = await getStrings();
  const { roleId } = await params;
  const query = await searchParams;
  const profileRef = typeof query.profile === "string" && query.profile ? query.profile : DEFAULT_SAMPLE;

  let data: PathwayData | null = null;
  let error: unknown = null;
  try {
    data = await loadPathway(getDb(), roleId, profileRef);
  } catch (err) {
    error = err;
  }
  if (!data) {
    return (
      <>
        <PageHero eyebrow={s.pathwayEyebrow} title={s.resultsNoProfile} />
        <PageBody>{error ? <DbError s={s} err={error} where="pathway page" /> : <p className="text-sm">{s.resultsNoProfile}</p>}</PageBody>
      </>
    );
  }
  return (
    <div lang={locale}>
      <PathwayView s={s} locale={locale} data={data} />
    </div>
  );
}

function reasonText(s: Strings, c: SdgContribution): string {
  const v = c.values;
  switch (c.kind) {
    case "skills":
      return fmt(s.sdgReason44, { n: v.n, skills: v.skills });
    case "affordable":
      return fmt(s.sdgReason43, {
        free: v.free,
        total: v.total,
        hrdc: Number(v.hrdc) > 0 ? fmt(s.sdgReason43Hrdc, { n: v.hrdc }) : "",
        rest: Number(v.low) > 0 ? s.sdgReason43Rest : "",
      });
    case "demand":
      return fmt(s.sdgReason85, { demand: v.demand });
    case "productivity":
      return s.sdgReason82;
    default:
      return String(v.reason ?? "");
  }
}

function PathwayView({ s, locale, data }: { s: Strings; locale: Locale; data: PathwayData }) {
  const { pathway, role, skillNames } = data;
  const backHref = `/results?profile=${encodeURIComponent(data.profile.ref)}`;
  const { free, low, hrdc_claimable: hrdc } = pathway.costCounts;

  return (
    <>
      <PageHero
        eyebrow={
          <>
            <Link href={backHref} className="mb-4 block font-sans text-sm font-semibold tracking-normal normal-case">
              ← {s.pathwayBack}
            </Link>
            {s.pathwayEyebrow}
          </>
        }
        title={role.title}
        intro={
          <>
            {fmt(s.pathwayFor, { name: data.profile.displayName, hours: data.profile.hoursPerWeek, budget: costLabel(s, data.profile.budget) })}
            {!data.profile.isSample && (
              <>
                {" "}
                <Link href="/intake" className="font-semibold text-pr">
                  {s.pathwayChangeProfile}
                </Link>
              </>
            )}
          </>
        }
      >
        <div className="mt-4 flex flex-wrap gap-1.5">
          {role.sdgIds.map((g) => (
            <SdgChip key={g} goal={g} locale={locale} named />
          ))}
        </div>
      </PageHero>

      <section className="wrap flex flex-wrap items-start gap-6 pt-10 pb-18">
        <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-4">
          {pathway.steps.length === 0 ? (
            <p className="card text-sm">{s.pathwayNoGap}</p>
          ) : (
            <div className="card flex flex-col gap-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-2xl bg-sf2 p-4">
                  <div className="text-3xl font-extrabold tracking-[-0.03em]">{pathway.totalHours}</div>
                  <div className="text-[13px] text-mu">{s.pathwayHours}</div>
                </div>
                <div className="rounded-2xl bg-sf2 p-4">
                  <div className="text-3xl font-extrabold tracking-[-0.03em]">{pathway.totalWeeks}</div>
                  <div className="text-[13px] text-mu">
                    {s.pathwayWeeksLabel} · {fmt(s.resultsHoursWeek, { n: pathway.hoursPerWeek })}
                  </div>
                </div>
                <div className="rounded-2xl bg-upbg p-4 text-up">
                  <div className="text-3xl font-extrabold tracking-[-0.03em]">
                    {free}/{pathway.steps.length}
                  </div>
                  <div className="text-[13px]">{fmt(s.pathwayCosts, { free, low, hrdc })}</div>
                </div>
              </div>
              {data.schedule.length > 0 && (
                <ol className="flex gap-1" aria-label={s.pathwayScheduleTitle}>
                  {data.schedule.map((w) => (
                    <li
                      key={w.week}
                      className="flex min-w-0 flex-1 flex-col items-center gap-1"
                      title={`${fmt(s.pathwayWeek, { from: w.week })}: ${w.steps.map((n) => pathway.steps[n - 1].course.title).join(" + ")}`}
                    >
                      <span className={`h-2.5 w-full rounded ${STEP_COLORS[(w.steps[0] - 1) % STEP_COLORS.length]}`} />
                      <span className="font-mono text-[11px] text-mu">W{w.week}</span>
                    </li>
                  ))}
                </ol>
              )}
              <p className="text-xs text-mu">⚠ {s.pathwayEstimateNote}</p>
            </div>
          )}

          {pathway.steps.length > 0 && (
            <div className="flex flex-col">
              <div className="relative">
                <div className="absolute top-6 bottom-10 left-[19px] w-[3px] rounded bg-linear-to-b from-pr to-up" aria-hidden />
                <ol className="flex flex-col">
                {pathway.steps.map((step) => (
                  <li key={step.course.id} className="relative flex gap-4 pb-4">
                    <span className="flex size-10 flex-none items-center justify-center rounded-full border-[3px] border-pr bg-sf font-mono text-sm font-bold text-pr">
                      {step.order}
                    </span>
                    <div className="card flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <b className="font-semibold text-mu">
                          {step.startWeek === step.endWeek ? fmt(s.pathwayWeek, { from: step.startWeek }) : fmt(s.pathwayWeeks, { from: step.startWeek, to: step.endWeek })}
                        </b>
                        <Badge tone={COST_TONE[step.course.cost]}>{costLabel(s, step.course.cost)}</Badge>
                        <Badge>
                          {step.course.hours} h{step.course.hoursEstimated ? "*" : ""}
                        </Badge>
                        <span className="text-mu uppercase">{step.course.language}</span>
                      </div>
                      <h2 className="text-lg leading-snug font-semibold">{step.course.title}</h2>
                      <div className="text-sm text-mu">{step.course.provider}</div>
                      <div className="text-sm">
                        <b className="font-semibold">{s.pathwayCovers}:</b> {step.covers.map((id) => skillNames[id]).join(", ")}
                      </div>
                      {step.course.notes && <p className="text-xs text-mu">{step.course.notes}</p>}
                      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
                        <a href={step.course.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-pr">
                          {s.pathwayOpen} ↗
                        </a>
                        {step.alternatives.length > 0 && (
                          <details className="w-full sm:w-auto">
                            <summary className="cursor-pointer font-medium text-mu">{s.pathwayAlternatives}</summary>
                            <ul className="mt-2 flex flex-col gap-1.5 text-xs">
                              {step.alternatives.map((a) => (
                                <li key={a.course.id}>
                                  <a href={a.course.url} target="_blank" rel="noopener noreferrer" className="font-medium underline">
                                    {a.course.title}
                                  </a>{" "}
                                  <span className="text-mu">
                                    · {a.course.provider} · {costLabel(s, a.course.cost)} · {a.course.hours} h{a.course.hoursEstimated ? "*" : ""}
                                  </span>
                                  {!a.withinBudget && <span className="text-am"> ({s.pathwayOverBudget})</span>}
                                </li>
                              ))}
                            </ul>
                          </details>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
                </ol>
              </div>
              <p className="ml-14 text-[13px] leading-normal text-mu">{s.pathwayRule}</p>
            </div>
          )}

          {pathway.overBudget.length > 0 && (
            <div className="card flex flex-col gap-2 text-sm">
              <b className="text-[17px] font-semibold text-am">{s.pathwayOverBudgetTitle}</b>
              <ul className="flex flex-col gap-1.5">
                {pathway.overBudget.map((o) => (
                  <li key={o.skill.skillId}>
                    {skillNames[o.skill.skillId]}:{" "}
                    <a href={o.course.url} target="_blank" rel="noopener noreferrer" className="font-medium underline">
                      {o.course.title}
                    </a>{" "}
                    <span className="text-mu">
                      ({o.course.provider}, {costLabel(s, o.course.cost)}, {o.course.hours} h{o.course.hoursEstimated ? "*" : ""})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.schedule.length > 0 && (
            <details className="card text-sm">
              <summary className="cursor-pointer text-[17px] font-semibold">{s.pathwayScheduleTitle}</summary>
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {data.schedule.map((w) => (
                  <li key={w.week} className="flex gap-3 rounded-xl bg-sf2 px-3 py-2">
                    <span className="w-16 flex-none font-mono text-xs leading-5 text-mu">{fmt(s.pathwayWeek, { from: w.week })}</span>
                    <span>{w.steps.map((n) => pathway.steps[n - 1].course.title).join(" + ")}</span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>

        <aside className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <div className="card flex flex-col gap-3.5">
            <b className="text-[17px] font-semibold">{s.pathwaySdgTitle}</b>
            <p className="-mt-1.5 text-[13px] text-mu">{s.pathwaySdgIntro}</p>
            {data.contributions.map((c) => (
              <div key={c.target} className="flex gap-2.5 text-sm leading-snug">
                <SdgTarget
                  goal={c.goal}
                  target={c.target}
                  title={`SDG ${c.goal}: ${(locale === "ms" ? SDG_GOALS[c.goal]?.ms : SDG_GOALS[c.goal]?.en) ?? ""} · ${s.sdgTarget} ${c.target}: ${SDG_TARGETS[c.target] ?? ""}`}
                />
                <span>{reasonText(s, c)}</span>
              </div>
            ))}
            {data.skillGoals.length > 0 && (
              <div className="border-t border-ln pt-3">
                <p className="text-xs font-medium text-mu">{s.pathwaySkillGoals}:</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {data.skillGoals.map((g) => (
                    <li key={g.goal}>
                      <SdgChip goal={g.goal} locale={locale} title={g.skills.join(", ")} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {pathway.uncovered.length > 0 && (
            <div className="card text-sm leading-normal">
              <b className="mb-1.5 block text-[17px] font-semibold text-am">{s.pathwayUncoveredTitle}</b>
              <p className="font-medium">{pathway.uncovered.map((u) => skillNames[u.skillId]).join(", ")}</p>
              <p className="mt-1 text-[13px] text-mu">{s.pathwayUncoveredText}</p>
            </div>
          )}

          {pathway.practice.length > 0 && (
            <div className="card text-sm leading-normal">
              <b className="mb-1.5 block text-[17px] font-semibold">{s.pathwayPracticeTitle}</b>
              <p className="font-medium">{pathway.practice.map((u) => skillNames[u.skillId]).join(", ")}</p>
              <p className="mt-1 text-[13px] text-mu">{s.pathwayPracticeText}</p>
            </div>
          )}

          {data.coursesVerifiedAt && <p className="text-xs text-mu">{fmt(s.pathwayVerified, { date: data.coursesVerifiedAt })}</p>}
        </aside>
      </section>
    </>
  );
}

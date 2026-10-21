"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fmt, type Locale, type Strings } from "@/lib/i18n";
import { RIASEC_TYPES, TYPE_INFO, riasecCode, sharedTopTypes, type RiasecScores } from "@/lib/riasec";
import { headlineChange } from "@/lib/scoring/diff";
import { finalScore, type Weights } from "@/lib/scoring/engine";
import type { ResultsData, RoleResult, ScenarioChanges, SignalRef } from "@/lib/scoring/results";
import { SdgChip } from "../sdg-chip";
import { Badge, Meter, PageHero, btnPrimary } from "../ui";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthYear = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
const pct = (x: number) => Math.round(x * 100);
const myt = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kuala_Lumpur" });
// "ILO Working Paper 140: Generative AI and Jobs…" → "ILO Working Paper 140"
const shortSource = (name: string) => {
  const head = name.split(/ \(|: |, via /)[0];
  return head.length > 32 ? `${head.slice(0, 31)}…` : head;
};

type Ranked = { role: RoleResult; score: number; band: number };
type Shares = { skill: number; demand: number; interest: number };

export function ResultsView({ data, s, locale }: { data: ResultsData; s: Strings; locale: Locale }) {
  const [scenarioKey, setScenarioKey] = useState(data.scenarios[0]?.key ?? "");
  const [weights, setWeights] = useState<Weights>(data.defaultWeights);
  const [includeDeclining, setIncludeDeclining] = useState(false);
  const scenario = data.scenarios.find((sc) => sc.key === scenarioKey) ?? data.scenarios[0];

  const weightSum = weights.skill + weights.demand + (data.profile.hasInterest ? weights.interest : 0);
  const normalized: Shares = {
    skill: weightSum ? weights.skill / weightSum : 0,
    demand: weightSum ? weights.demand / weightSum : 0,
    interest: weightSum && data.profile.hasInterest ? weights.interest / weightSum : 0,
  };

  const ranked: Ranked[] = useMemo(
    () =>
      data.roles
        .filter((r) => includeDeclining || r.outlook === "emerging")
        .map((role) => {
          const d = role.demand[scenarioKey];
          return {
            role,
            score: finalScore({ skill: role.skill.score, demand: d.normalized, interest: role.interest }, weights),
            band: normalized.demand * d.band,
          };
        })
        .sort((a, b) => b.score - a.score),
    [data.roles, includeDeclining, scenarioKey, weights, normalized.demand],
  );

  const atRisk = useMemo(
    () =>
      data.roles
        .filter((r) => r.outlook === "declining" && r.skill.score >= 0.5)
        .sort((a, b) => b.skill.score - a.skill.score)
        .slice(0, 3),
    [data.roles],
  );

  return (
    <>
      <PageHero
        eyebrow={`${s.navResults} · ${data.profile.displayName}`}
        title={s.resultsTitle}
        intro={
          <>
            {data.profile.headline}
            {data.profile.isSample && <span className="block text-sm">{s.resultsSampleNote}</span>}
          </>
        }
      >
        <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-mu">
          {s.resultsTrySample}:
          {data.samples.map((sample) => (
            <Link
              key={sample.key}
              href={`/results?profile=${sample.key}`}
              aria-current={sample.key === data.profile.sampleKey ? "true" : undefined}
              className={`rounded-full border px-3 py-1 font-medium ${sample.key === data.profile.sampleKey ? "border-pr bg-pr text-pri" : "border-ln bg-sf text-ink hover:border-mu"}`}
            >
              {sample.displayName}
            </Link>
          ))}
        </div>
        <div className="mt-5 inline-flex max-w-full flex-col gap-1 rounded-xl bg-ambg px-3.5 py-2.5 text-sm text-am">
          <p>
            <b>⚠ {s.resultsEstimate}.</b> <span className="text-ink/80">{s.resultsEstimateText}</span>
          </p>
          <p className="text-xs text-ink/70">
            {s.signalsLastUpdated}: {data.lastUpdated ? myt.format(new Date(data.lastUpdated)) : "–"} ·{" "}
            <Link href="/signals" className="underline">
              {s.navSignals}
            </Link>{" "}
            · {data.similarityMethod === "embedding" ? fmt(s.resultsMatchingEmbedding, { model: data.similarityModel ?? "" }) : s.resultsMatching}
          </p>
        </div>
      </PageHero>

      <section className="wrap flex flex-wrap items-start gap-6 pt-10 pb-18">
        <aside className="flex min-w-0 flex-[1_1_280px] flex-col gap-4">
          <div className="card flex flex-col gap-3">
            <b className="text-[17px] font-semibold">{s.scenarioLabel}</b>
            <div className="flex gap-1 rounded-xl border border-ln bg-sf2 p-1" role="radiogroup" aria-label={s.scenarioLabel}>
              {data.scenarios.map((sc) => (
                <button
                  key={sc.key}
                  type="button"
                  role="radio"
                  aria-checked={sc.key === scenarioKey}
                  onClick={() => setScenarioKey(sc.key)}
                  className={`flex-1 rounded-[9px] px-3 py-2 text-sm font-semibold ${sc.key === scenarioKey ? "bg-pr text-pri" : "text-ink"}`}
                >
                  {sc.name.replace(/ \(to 2030\)$/, "")}
                </button>
              ))}
            </div>
            {scenario && (
              <div className="text-[13px] leading-normal text-mu">
                <p>{scenario.description}</p>
                <p className="mt-1 italic">{scenario.notes}</p>
              </div>
            )}
          </div>

          <div className="card flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <b className="text-[17px] font-semibold">{s.weightsTitle}</b>
              <button type="button" onClick={() => setWeights(data.defaultWeights)} className="text-sm font-semibold text-pr">
                {s.weightsReset}
              </button>
            </div>
            <p className="-mt-2 text-[13px] leading-snug text-mu">{s.weightsHelp}</p>
            <WeightSlider label={s.weightSkill} value={weights.skill} share={normalized.skill} onChange={(v) => setWeights({ ...weights, skill: v })} />
            <WeightSlider label={s.weightDemand} value={weights.demand} share={normalized.demand} onChange={(v) => setWeights({ ...weights, demand: v })} />
            {data.profile.hasInterest ? (
              <WeightSlider label={s.weightInterest} value={weights.interest} share={normalized.interest} onChange={(v) => setWeights({ ...weights, interest: v })} />
            ) : (
              <p className="rounded-2xl bg-sf2 px-3.5 py-3 text-[13px] text-mu">
                {s.weightInterest}: {s.weightInterestLater}{" "}
                <Link href="/intake" className="font-semibold text-pr">
                  {s.navIntake} →
                </Link>
              </p>
            )}
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input type="checkbox" className="mt-[3px]" checked={includeDeclining} onChange={(e) => setIncludeDeclining(e.target.checked)} />
              {s.includeDeclining}
            </label>
          </div>

          <WhatChanged data={data} changes={data.changes[scenarioKey] ?? null} s={s} />
        </aside>

        <div className="flex min-w-0 flex-[3_1_560px] flex-col gap-4">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xl font-semibold">
              {s.topRolesTitle} <span className="font-normal text-mu">({ranked.length})</span>
            </h2>
            <span className="text-[13px] text-mu">{s.resultsSortedBy}</span>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] gap-4">
            {ranked.slice(0, 4).map((r, i) => (
              <RoleCard key={r.role.id} rank={i + 1} ranked={r} data={data} scenarioKey={scenarioKey} weights={normalized} s={s} locale={locale} />
            ))}
          </div>
          {ranked.length > 4 && (
            <ol className="card py-2" start={5}>
              {ranked.slice(4, 10).map((r, i) => (
                <li key={r.role.id} className="flex flex-wrap items-center gap-x-3.5 gap-y-1 border-b border-ln py-3.5 text-sm last:border-b-0">
                  <span className="w-6 font-mono text-mu">{i + 5}</span>
                  <Link href={`/pathway/${r.role.slug}?profile=${encodeURIComponent(data.profile.ref)}`} className="flex-[1_1_200px] font-medium hover:text-pr">
                    {r.role.title}
                  </Link>
                  <span className="text-[13px] text-mu">
                    {s.skillsScore} {pct(r.role.skill.score)} · {s.demandScore} {pct(r.role.demand[scenarioKey].normalized)}
                  </span>
                  <b className="w-8 text-right">{pct(r.score)}</b>
                </li>
              ))}
            </ol>
          )}

          {atRisk.length > 0 && !includeDeclining && (
            <div className="card flex flex-col gap-3">
              <div>
                <b className="text-[17px] font-semibold">{s.atRiskTitle}</b>
                <p className="mt-1 text-sm text-mu">{s.atRiskText}</p>
              </div>
              <ul className="flex flex-wrap gap-2">
                {atRisk.map((r) => (
                  <li key={r.id} className="rounded-lg bg-dnbg px-3 py-1.5 text-[13px] font-medium text-dn">
                    ↓ {r.title} · {s.skillsScore} {pct(r.skill.score)} · {s.demandScore} {pct(r.demand[scenarioKey].normalized)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Radar data={data} scenarioKey={scenarioKey} s={s} />
        </div>
      </section>
    </>
  );
}

function WeightSlider({ label, value, share, onChange }: { label: string; value: number; share: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="flex justify-between">
        <span>{label}</span>
        <b className="font-mono tabular-nums">{pct(share)}%</b>
      </span>
      <input type="range" aria-label={label} min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function SourceChip({ signal }: { signal: SignalRef | undefined }) {
  if (!signal) return null;
  return (
    <a
      href={signal.url}
      target="_blank"
      rel="noopener noreferrer"
      title={signal.title}
      className="inline-block max-w-full truncate rounded-md border border-ln bg-sf px-1.5 py-0.5 align-middle font-mono text-[11px] text-mu hover:border-pr hover:text-pr"
    >
      {shortSource(signal.sourceName)} · {monthYear(signal.publishedDate)}
    </a>
  );
}

/** Score ring: the arc fills to the score, in the accent colour. */
function ScoreRing({ score, lo, hi }: { score: number; lo: number; hi: number }) {
  return (
    <div className="flex flex-none flex-col items-center gap-1.5">
      <div className="flex size-[68px] items-center justify-center rounded-full" style={{ background: `conic-gradient(var(--pr) ${score * 3.6}deg, var(--sf2) 0deg)` }}>
        <div className="flex size-14 items-center justify-center rounded-full bg-sf">
          <b className="text-[22px] leading-none">{score}</b>
        </div>
      </div>
      <span className="font-mono text-[11px] text-mu">
        {lo}–{hi}
      </span>
    </div>
  );
}

function RoleCard({
  rank,
  ranked,
  data,
  scenarioKey,
  weights,
  s,
  locale,
}: {
  rank: number;
  ranked: Ranked;
  data: ResultsData;
  scenarioKey: string;
  weights: Shares;
  s: Strings;
  locale: Locale;
}) {
  const { role, score, band } = ranked;
  const d = role.demand[scenarioKey];
  const total = role.skill.covered.length + role.skill.missing.length;
  const confLabel = d.confidence === "high" ? s.confHigh : d.confidence === "medium" ? s.confMedium : s.confLow;
  const exposureLabel = role.aiExposure === "high" ? s.exposureHigh : role.aiExposure === "medium" ? s.exposureMedium : s.exposureLow;
  const demandLine = role.signalCount < 2 ? s.whyDemandNone : fmt(d.raw >= 0 ? s.whyDemandUp : s.whyDemandDown, { n: role.signalCount });

  return (
    <article className="card flex flex-col gap-4">
      <div className="flex items-start gap-3.5">
        <div className="min-w-0 flex-1">
          <div className="font-mono text-xs font-semibold text-mu">
            #{rank} · {role.sector}
          </div>
          <h3 className="mt-1 text-lg leading-tight font-semibold">
            {role.title}
            {role.outlook === "declining" && <span className="ml-2 text-sm font-normal text-dn">↓ {s.signalsDeclining}</span>}
          </h3>
          <div className="mt-2 flex flex-wrap gap-1">
            {role.sdgIds.map((g) => (
              <SdgChip key={g} goal={g} locale={locale} title={`${role.sdgTargets.filter((tg) => tg.startsWith(`${g}.`)).join(", ")} · ${role.sdgReason}`} />
            ))}
          </div>
        </div>
        <ScoreRing score={pct(score)} lo={pct(Math.max(0, score - band))} hi={pct(Math.min(1, score + band))} />
      </div>

      <div className={`grid gap-3 text-xs ${role.interest !== null ? "grid-cols-3" : "grid-cols-2"}`}>
        <div>
          <div className="flex justify-between text-mu">
            <span>{s.skillsScore}</span>
            <b className="text-ink">{pct(role.skill.score)}</b>
          </div>
          <div className="mt-1.5">
            <Meter value={role.skill.score} />
          </div>
        </div>
        <div title={`${s.confidence}: ${confLabel}`}>
          <div className="flex justify-between text-mu">
            <span>
              {s.demandScore} ±{pct(d.band)}
            </span>
            <b className="text-ink">{pct(d.normalized)}</b>
          </div>
          <div className="mt-1.5">
            <Meter value={d.normalized} color={d.normalized >= 0.5 ? "bg-up" : "bg-dn"} />
          </div>
        </div>
        {role.interest !== null && (
          <div>
            <div className="flex justify-between text-mu">
              <span>{s.interestScore}</span>
              <b className="text-ink">{pct(role.interest)}</b>
            </div>
            <div className="mt-1.5">
              <Meter value={role.interest} color="bg-info" />
            </div>
          </div>
        )}
      </div>

      <ul className="flex flex-wrap gap-1" aria-label={`${s.skillsHave} / ${s.skillsGap}`}>
        {role.skill.covered.map((c) => (
          <li key={c.skillId} className="rounded-lg bg-upbg px-2.5 py-1 text-xs font-medium text-up" title={s.skillsHave}>
            ✓ {data.skillNames[c.skillId]}
            {c.viaSkillId !== null && ` (${s.viaRelated} ${data.skillNames[c.viaSkillId]})`}
          </li>
        ))}
        {role.skill.missing.map((m) => (
          <li key={m.skillId} className="rounded-lg border border-dashed border-mu px-2.5 py-[3px] text-xs text-mu" title={`${s.skillsGap} · ${"•".repeat(m.importance)}`}>
            + {data.skillNames[m.skillId]}
          </li>
        ))}
      </ul>

      <p className="rounded-xl bg-sf2 px-3 py-2 font-mono text-xs break-words text-mu">
        {weights.skill.toFixed(2)} × {pct(role.skill.score)} + {weights.demand.toFixed(2)} × {pct(d.normalized)}
        {role.interest !== null && ` + ${weights.interest.toFixed(2)} × ${pct(role.interest)}`} = {pct(score)}
      </p>

      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-pr">{s.resultsDetails}</summary>
        <div className="mt-3 flex flex-col gap-3">
          <p className="leading-normal">
            {fmt(s.whySkills, { have: role.skill.covered.length, total, pct: pct(role.skill.score) })} {demandLine}{" "}
            {d.multiplier !== 1 && fmt(s.whyScenario, { exposure: exposureLabel, m: d.multiplier.toFixed(2) })} ({s.confidence}: {confLabel})
          </p>
          <p className="text-xs text-mu">{role.sdgReason}</p>
          {data.profile.riasec && role.riasec && <InterestCompare s={s} locale={locale} user={data.profile.riasec} role={role.riasec} source={role.riasecSource} />}
          <div>
            <b className="text-[13px] font-semibold">
              {s.signalsBehind} ({role.signalCount})
            </b>
            <ul className="mt-2 flex flex-col gap-2">
              {role.contributions.map((c) => {
                const sig = data.signals[c.signalId];
                if (!sig) return null;
                return (
                  <li key={c.signalId} className="flex flex-col gap-1 border-t border-ln pt-2">
                    <span className="flex items-baseline gap-2">
                      <span className={`w-11 flex-none text-right font-mono text-xs ${c.value >= 0 ? "text-up" : "text-dn"}`}>
                        {c.value >= 0 ? "+" : ""}
                        {c.value.toFixed(2)}
                      </span>
                      <span className="min-w-0 flex-1">{sig.title}</span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2 pl-13 text-xs text-mu">
                      <SourceChip signal={sig} />
                      {c.via === "direct" ? s.nameRole : `${s.viaSkill} ${data.skillNames[c.via]}`}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 text-xs text-mu">
              {s.roleSource}:{" "}
              <a href={role.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
                {role.sourceName}
              </a>
            </p>
          </div>
        </div>
      </details>

      <Link href={`/pathway/${role.slug}?profile=${encodeURIComponent(data.profile.ref)}`} className={`${btnPrimary} mt-auto`}>
        {s.resultsSeePathway} →
      </Link>
    </article>
  );
}

function InterestCompare({ s, locale, user, role, source }: { s: Strings; locale: Locale; user: RiasecScores; role: RiasecScores; source: string | null }) {
  const shared = sharedTopTypes(user, role);
  const names = (types: string[]) => types.map((t) => TYPE_INFO[t as keyof typeof TYPE_INFO][locale]).join(" & ");
  return (
    <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-sf2 p-3">
      <RiasecHexagon user={user} role={role} />
      <div className="min-w-0 flex-1">
        <p>
          <span className="text-pr">■</span> {s.riasecYou}: <strong>{riasecCode(user)}</strong> · <span className="text-info">■</span> {s.riasecRole}:{" "}
          <strong>{riasecCode(role)}</strong>
        </p>
        <p className="mt-1">{shared.length > 0 ? fmt(s.interestShared, { types: names(shared) }) : s.interestDiffer}</p>
        {source && <p className="mt-1 text-xs text-mu">{source}</p>}
      </div>
    </div>
  );
}

/** Two RIASEC profiles on a hexagon: the person (accent) and the role (blue). */
function RiasecHexagon({ user, role }: { user: RiasecScores; role: RiasecScores }) {
  const size = 132;
  const c = size / 2;
  const r = 46;
  const point = (i: number, v: number) => {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    return [c + Math.cos(a) * r * v, c + Math.sin(a) * r * v] as const;
  };
  const poly = (p: RiasecScores) => RIASEC_TYPES.map((t, i) => point(i, Math.max(0.05, p[t])).join(",")).join(" ");
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Interest profiles: you ${riasecCode(user)}, role ${riasecCode(role)}`}>
      {[0.33, 0.66, 1].map((k) => (
        <polygon key={k} points={RIASEC_TYPES.map((_, i) => point(i, k).join(",")).join(" ")} className="fill-none stroke-ln" />
      ))}
      <polygon points={poly(role)} className="fill-info/20 stroke-info" strokeWidth={1.5} />
      <polygon points={poly(user)} className="fill-pr/20 stroke-pr" strokeWidth={1.5} />
      {RIASEC_TYPES.map((t, i) => {
        const [x, y] = point(i, 1.25);
        return (
          <text key={t} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-mu text-[10px]">
            {t}
          </text>
        );
      })}
    </svg>
  );
}

function Radar({ data, scenarioKey, s }: { data: ResultsData; scenarioKey: string; s: Strings }) {
  const byDemand = [...data.roles].sort((a, b) => b.demand[scenarioKey].normalized - a.demand[scenarioKey].normalized);
  const rising = byDemand.filter((r) => r.demand[scenarioKey].normalized > 0.5).slice(0, 5);
  const declining = byDemand.filter((r) => r.demand[scenarioKey].normalized < 0.5).reverse().slice(0, 5);

  const column = (roles: RoleResult[], up: boolean) => (
    <div className="flex flex-col gap-3">
      <b className={`text-[15px] font-semibold ${up ? "text-up" : "text-dn"}`}>{up ? `↑ ${s.radarRisingRoles}` : `↓ ${s.radarDecliningRoles}`}</b>
      {roles.map((r) => (
        <div key={r.id} className="flex items-start gap-3">
          <span className={`flex size-7 flex-none items-center justify-center rounded-lg text-[13px] font-bold ${up ? "bg-upbg text-up" : "bg-dnbg text-dn"}`} aria-hidden>
            {up ? "↑" : "↓"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{r.title}</div>
            <div className="my-1.5">
              <Meter value={r.demand[scenarioKey].normalized} color={up ? "bg-up" : "bg-dn"} />
            </div>
            <SourceChip signal={data.signals[r.contributions[0]?.signalId]} />
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="card flex flex-col gap-4">
      <div>
        <span className="eyebrow">{s.radarEyebrow}</span>
        <h2 className="mt-1 text-xl font-semibold">{s.radarTitle}</h2>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        {column(rising, true)}
        {column(declining, false)}
      </div>
      <p className="text-xs text-mu">{s.radarNote}</p>
    </div>
  );
}

function WhatChanged({ data, changes, s }: { data: ResultsData; changes: ScenarioChanges | null; s: Strings }) {
  if (!changes) {
    return (
      <div className="card flex flex-col gap-2 border-dashed">
        <span className="font-mono text-xs font-semibold tracking-[0.06em] text-mu uppercase">{s.changedTitle}</span>
        <p className="text-sm leading-normal text-mu">{s.changedNone}</p>
      </div>
    );
  }
  const title = new Map(data.roles.map((r) => [r.id, r.title]));
  const date = myt.format(new Date(changes.prevComputedAt));
  const head = headlineChange(changes);
  const headNew = head ? (changes.newSignalsByRole[head.roleId] ?? []).length : 0;
  const headline = !head
    ? s.changedNoMoves
    : (head.prevRank ?? 99) > (head.currRank ?? 99)
      ? fmt(headNew > 0 ? s.changedHeadlineUp : s.changedHeadlineUpNoNew, { rank: head.currRank ?? "–", title: title.get(head.roleId) ?? "", prev: head.prevRank ?? "–", n: headNew, date })
      : fmt(s.changedHeadlineDown, { title: title.get(head.roleId) ?? "", prev: head.prevRank ?? "–", rank: head.currRank ?? "–", date });

  return (
    <div className="card flex flex-col gap-2.5">
      <span className="font-mono text-xs font-semibold tracking-[0.06em] text-mu uppercase">{s.changedTitle}</span>
      <p className="text-sm leading-normal font-medium">{headline}</p>
      <p className="text-xs text-mu">{fmt(s.changedSince, { date, n: changes.newSignalIds.length })}</p>
      <ul className="mt-1 flex flex-col gap-2 text-[13px]">
        {changes.changes.map((c) => {
          const up = (c.prevRank ?? 99) > (c.currRank ?? 99);
          const same = c.prevRank === c.currRank;
          const fresh = changes.newSignalsByRole[c.roleId] ?? [];
          return (
            <li key={c.roleId} className="flex flex-col gap-1 border-t border-ln pt-2">
              <span className="flex flex-wrap items-baseline gap-x-2">
                <span className={`w-3 font-bold ${same ? "text-mu" : up ? "text-up" : "text-dn"}`}>{same ? "=" : up ? "↑" : "↓"}</span>
                <span className="font-medium">{title.get(c.roleId)}</span>
                <span className="text-mu">{c.prevRank === null ? s.changedNewEntry : c.currRank === null ? s.changedLeft : `#${c.prevRank} → #${c.currRank}`}</span>
                {Math.abs(c.scoreDelta) >= 0.005 && (
                  <span className="text-xs text-mu">({fmt(s.changedPoints, { delta: `${c.scoreDelta > 0 ? "+" : ""}${pct(c.scoreDelta)}` })})</span>
                )}
              </span>
              {fresh.length > 0 && (
                <span className="flex flex-wrap gap-1 pl-5">
                  {fresh.slice(0, 2).map((id) => (
                    <SourceChip key={id} signal={data.signals[id]} />
                  ))}
                  {fresh.length > 2 && <Badge className="py-0.5">+{fresh.length - 2}</Badge>}
                </span>
              )}
            </li>
          );
        })}
      </ul>
      <Link href="/signals" className="text-sm font-semibold text-pr">
        {s.resultsSeeSignals} →
      </Link>
    </div>
  );
}

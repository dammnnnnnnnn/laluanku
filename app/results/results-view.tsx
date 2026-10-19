"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { fmt, type Strings } from "@/lib/i18n";
import { RIASEC_TYPES, TYPE_INFO, riasecCode, sharedTopTypes, type RiasecScores } from "@/lib/riasec";
import { finalScore, type Weights } from "@/lib/scoring/engine";
import type { ResultsData, RoleResult, SignalRef } from "@/lib/scoring/results";

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

export function ResultsView({ data, s }: { data: ResultsData; s: Strings }) {
  const [scenarioKey, setScenarioKey] = useState(data.scenarios[0]?.key ?? "");
  const [weights, setWeights] = useState<Weights>(data.defaultWeights);
  const [includeDeclining, setIncludeDeclining] = useState(false);
  const scenario = data.scenarios.find((sc) => sc.key === scenarioKey) ?? data.scenarios[0];

  const weightSum = weights.skill + weights.demand + (data.profile.hasInterest ? weights.interest : 0);
  const normalized = {
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
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">{s.resultsTitle}</h1>
        <div className="flex flex-col gap-1 text-sm">
          <p>
            {s.resultsFor} <strong>{data.profile.displayName}</strong>: {data.profile.headline}
          </p>
          {data.profile.isSample && <p className="text-zinc-500">{s.resultsSampleNote}</p>}
          <p className="flex flex-wrap items-center gap-2 text-zinc-600 dark:text-zinc-400">
            {s.resultsTrySample}:
            {data.samples.map((sample) => (
              <Link
                key={sample.key}
                href={`/results?profile=${sample.key}`}
                className={`rounded-full border px-3 py-0.5 ${sample.key === data.profile.sampleKey ? "border-emerald-700 bg-emerald-700 text-white" : "border-zinc-300 dark:border-zinc-700"}`}
              >
                {sample.displayName}
              </Link>
            ))}
          </p>
        </div>
      </header>

      <section className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-semibold">⚠ {s.resultsEstimate}</p>
        <p className="mt-1">{s.resultsEstimateText}</p>
        <p className="mt-2 text-xs opacity-80">
          {s.signalsLastUpdated}: {data.lastUpdated ? myt.format(new Date(data.lastUpdated)) : "–"} ·{" "}
          <Link href="/signals" className="underline">
            {s.navSignals}
          </Link>{" "}
          · {s.resultsMatching}
        </p>
      </section>

      <section className="grid gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold">{s.scenarioLabel}</h2>
          <div className="mt-2 inline-flex rounded-md border border-zinc-300 p-0.5 dark:border-zinc-700" role="radiogroup" aria-label={s.scenarioLabel}>
            {data.scenarios.map((sc) => (
              <button
                key={sc.key}
                type="button"
                role="radio"
                aria-checked={sc.key === scenarioKey}
                onClick={() => setScenarioKey(sc.key)}
                className={`rounded px-3 py-1.5 text-sm ${sc.key === scenarioKey ? "bg-emerald-700 text-white" : ""}`}
              >
                {sc.name.replace(/ \(to 2030\)$/, "")}
              </button>
            ))}
          </div>
          {scenario && (
            <div className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
              <p>{scenario.description}</p>
              <p className="mt-1 italic">{scenario.notes}</p>
            </div>
          )}
        </div>
        <div>
          <h2 className="text-sm font-semibold">{s.weightsTitle}</h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">{s.weightsHelp}</p>
          <WeightSlider label={s.weightSkill} value={weights.skill} share={normalized.skill} onChange={(v) => setWeights({ ...weights, skill: v })} />
          <WeightSlider label={s.weightDemand} value={weights.demand} share={normalized.demand} onChange={(v) => setWeights({ ...weights, demand: v })} />
          {data.profile.hasInterest ? (
            <WeightSlider label={s.weightInterest} value={weights.interest} share={normalized.interest} onChange={(v) => setWeights({ ...weights, interest: v })} />
          ) : (
            <p className="mt-1 text-xs text-zinc-500">
              {s.weightInterest}: {s.weightInterestLater}{" "}
              <Link href="/intake" className="underline">
                {s.navIntake}
              </Link>
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={includeDeclining} onChange={(e) => setIncludeDeclining(e.target.checked)} />
              {s.includeDeclining}
            </label>
            <button type="button" onClick={() => setWeights(data.defaultWeights)} className="text-emerald-700 underline dark:text-emerald-400">
              {s.weightsReset}
            </button>
          </div>
        </div>
      </section>

      <Radar data={data} scenarioKey={scenarioKey} s={s} />

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold">{s.topRolesTitle}</h2>
        {ranked.slice(0, 3).map((r, i) => (
          <RoleCard key={r.role.id} rank={i + 1} ranked={r} data={data} scenarioKey={scenarioKey} weights={normalized} s={s} />
        ))}
        {ranked.length > 3 && (
          <ol start={4} className="flex flex-col gap-1 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
            {ranked.slice(3, 10).map((r, i) => (
              <li key={r.role.id} className="flex flex-wrap items-baseline gap-x-3">
                <span className="w-6 text-zinc-500">{i + 4}.</span>
                <span className="flex-1">{r.role.title}</span>
                <span className="text-zinc-500">
                  {s.skillsScore} {pct(r.role.skill.score)} · {s.demandScore} {pct(r.role.demand[scenarioKey].normalized)}
                </span>
                <span className="w-10 text-right font-medium">{pct(r.score)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {atRisk.length > 0 && !includeDeclining && (
        <section className="rounded-lg border border-rose-200 p-4 text-sm dark:border-rose-900">
          <h2 className="font-semibold">{s.atRiskTitle}</h2>
          <p className="mt-1 text-zinc-600 dark:text-zinc-400">{s.atRiskText}</p>
          <ul className="mt-2 flex flex-col gap-1">
            {atRisk.map((r) => (
              <li key={r.id}>
                ↓ {r.title}: {s.skillsScore} {pct(r.skill.score)} · {s.demandScore} {pct(r.demand[scenarioKey].normalized)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function WeightSlider({ label, value, share, onChange }: { label: string; value: number; share: number; onChange: (v: number) => void }) {
  return (
    <label className="mt-2 flex items-center gap-3 text-sm">
      <span className="w-36 shrink-0">{label}</span>
      <input type="range" aria-label={label} min={0} max={1} step={0.05} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1 accent-emerald-700" />
      <span className="w-10 text-right tabular-nums">{pct(share)}%</span>
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
      className="inline-block max-w-full truncate rounded border border-zinc-300 px-1.5 py-0.5 align-middle text-[11px] text-zinc-600 hover:border-emerald-700 dark:border-zinc-700 dark:text-zinc-400"
    >
      {shortSource(signal.sourceName)} · {monthYear(signal.publishedDate)}
    </a>
  );
}

function Bar({ value, tone }: { value: number; tone: "up" | "down" | "neutral" }) {
  const color = tone === "up" ? "bg-sky-600" : tone === "down" ? "bg-rose-600" : "bg-emerald-700";
  return (
    <span className="inline-block h-1.5 w-16 overflow-hidden rounded bg-zinc-200 align-middle dark:bg-zinc-800">
      <span className={`block h-full ${color}`} style={{ width: `${Math.max(2, pct(value))}%` }} />
    </span>
  );
}

function Radar({ data, scenarioKey, s }: { data: ResultsData; scenarioKey: string; s: Strings }) {
  const byDemand = [...data.roles].sort((a, b) => b.demand[scenarioKey].normalized - a.demand[scenarioKey].normalized);
  const rising = byDemand.filter((r) => r.demand[scenarioKey].normalized > 0.5).slice(0, 5);
  const declining = byDemand.filter((r) => r.demand[scenarioKey].normalized < 0.5).reverse().slice(0, 5);
  const risingSkills = data.skillsOutlook.filter((x) => x.value > 0).slice(0, 6);
  const decliningSkills = data.skillsOutlook.filter((x) => x.value < 0).reverse().slice(0, 5);
  const strongest = (ids: number[]) => ids.map((id) => data.signals[id]).filter(Boolean).sort((a, b) => b.strength - a.strength)[0];

  const roleItem = (r: RoleResult, tone: "up" | "down") => (
    <li key={r.id} className="flex items-start gap-2">
      <span className="pt-1.5">
        <Bar value={r.demand[scenarioKey].normalized} tone={tone} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block">{r.title}</span>
        <SourceChip signal={data.signals[r.contributions[0]?.signalId]} />
      </span>
    </li>
  );
  const skillItem = (x: ResultsData["skillsOutlook"][number], tone: "up" | "down") => (
    <li key={x.skillId} className="flex items-start gap-2">
      <span className={tone === "up" ? "text-sky-700 dark:text-sky-400" : "text-rose-700 dark:text-rose-400"}>{tone === "up" ? "↑" : "↓"}</span>
      <span className="min-w-0 flex-1">
        <span className="block">{x.name}</span>
        <SourceChip signal={strongest(x.signalIds)} />
      </span>
    </li>
  );

  return (
    <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-xl font-semibold">{s.radarTitle}</h2>
      <div className="mt-3 grid gap-4 text-sm md:grid-cols-2">
        <div>
          <h3 className="mb-1 font-medium text-sky-800 dark:text-sky-300">↑ {s.radarRisingRoles}</h3>
          <ul className="flex flex-col gap-1.5">{rising.map((r) => roleItem(r, "up"))}</ul>
        </div>
        <div>
          <h3 className="mb-1 font-medium text-rose-800 dark:text-rose-300">↓ {s.radarDecliningRoles}</h3>
          <ul className="flex flex-col gap-1.5">{declining.map((r) => roleItem(r, "down"))}</ul>
        </div>
        <div>
          <h3 className="mb-1 font-medium text-sky-800 dark:text-sky-300">{s.radarRisingSkills}</h3>
          <ul className="flex flex-col gap-1.5">{risingSkills.map((x) => skillItem(x, "up"))}</ul>
        </div>
        <div>
          <h3 className="mb-1 font-medium text-rose-800 dark:text-rose-300">{s.radarDecliningSkills}</h3>
          <ul className="flex flex-col gap-1.5">{decliningSkills.map((x) => skillItem(x, "down"))}</ul>
        </div>
      </div>
      <p className="mt-3 text-xs text-zinc-500">{s.radarNote}</p>
    </section>
  );
}

function RoleCard({
  rank,
  ranked,
  data,
  scenarioKey,
  weights,
  s,
}: {
  rank: number;
  ranked: Ranked;
  data: ResultsData;
  scenarioKey: string;
  weights: { skill: number; demand: number; interest: number };
  s: Strings;
}) {
  const { role, score, band } = ranked;
  const d = role.demand[scenarioKey];
  const total = role.skill.covered.length + role.skill.missing.length;
  const confLabel = d.confidence === "high" ? s.confHigh : d.confidence === "medium" ? s.confMedium : s.confLow;
  const exposureLabel = role.aiExposure === "high" ? s.exposureHigh : role.aiExposure === "medium" ? s.exposureMedium : s.exposureLow;
  const demandLine =
    role.signalCount < 2 ? s.whyDemandNone : fmt(d.raw >= 0 ? s.whyDemandUp : s.whyDemandDown, { n: role.signalCount });

  return (
    <article className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-wrap items-start gap-3">
        <span className="text-2xl font-semibold text-zinc-400">#{rank}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold">
            {role.title}
            {role.outlook === "declining" && <span className="ml-2 text-sm font-normal text-rose-700 dark:text-rose-400">↓ {s.signalsDeclining}</span>}
          </h3>
          <p className="text-sm text-zinc-500">
            {role.sector} · {s.sdgLabel} {role.sdgIds.join(", ")}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-semibold tabular-nums">{pct(score)}</div>
          <div className="text-xs text-zinc-500">
            {s.matchScore} · {pct(Math.max(0, score - band))}–{pct(Math.min(1, score + band))}
          </div>
        </div>
      </div>

      <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <p className="flex items-center gap-2">
          <span className="w-20">{s.skillsScore}</span>
          <Bar value={role.skill.score} tone="neutral" />
          <span className="tabular-nums">{pct(role.skill.score)}</span>
        </p>
        <p className="flex items-center gap-2">
          <span className="w-20">{s.demandScore}</span>
          <Bar value={d.normalized} tone={d.normalized >= 0.5 ? "up" : "down"} />
          <span className="tabular-nums">
            {pct(d.normalized)} ±{pct(d.band)}
          </span>
          <span className="text-xs text-zinc-500">
            ({s.confidence}: {confLabel})
          </span>
        </p>
        {role.interest !== null && (
          <p className="flex items-center gap-2">
            <span className="w-20">{s.interestScore}</span>
            <Bar value={role.interest} tone="neutral" />
            <span className="tabular-nums">{pct(role.interest)}</span>
          </p>
        )}
      </div>
      <p className="mt-2 rounded bg-zinc-100 px-2 py-1 font-mono text-xs dark:bg-zinc-900">
        {s.formula}: {weights.skill.toFixed(2)} × {pct(role.skill.score)} + {weights.demand.toFixed(2)} × {pct(d.normalized)}
        {role.interest !== null && ` + ${weights.interest.toFixed(2)} × ${pct(role.interest)}`} = {pct(score)}
      </p>

      <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <h4 className="font-medium">{s.skillsHave}</h4>
          <ul className="mt-1 flex flex-wrap gap-1">
            {role.skill.covered.map((c) => (
              <li key={c.skillId} className="rounded bg-emerald-100 px-2 py-0.5 text-xs text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                {data.skillNames[c.skillId]}
                {c.viaSkillId !== null && ` (${s.viaRelated} ${data.skillNames[c.viaSkillId]})`}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="font-medium">{s.skillsGap}</h4>
          <ul className="mt-1 flex flex-wrap gap-1">
            {role.skill.missing.map((m) => (
              <li key={m.skillId} className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-700">
                {data.skillNames[m.skillId]} {"•".repeat(m.importance)}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-3 text-sm">
        <h4 className="font-medium">{s.whyTitle}</h4>
        <p className="mt-1 text-zinc-700 dark:text-zinc-300">
          {fmt(s.whySkills, { have: role.skill.covered.length, total, pct: pct(role.skill.score) })} {demandLine}{" "}
          {d.multiplier !== 1 && fmt(s.whyScenario, { exposure: exposureLabel, m: d.multiplier.toFixed(2) })}
        </p>
        <p className="mt-1 text-xs text-zinc-500">{role.sdgReason}</p>
      </div>

      {data.profile.riasec && role.riasec && <InterestCompare s={s} user={data.profile.riasec} role={role.riasec} source={role.riasecSource} />}

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-medium">
          {s.signalsBehind} ({role.signalCount})
        </summary>
        <ul className="mt-2 flex flex-col gap-1.5">
          {role.contributions.map((c) => {
            const sig = data.signals[c.signalId];
            if (!sig) return null;
            return (
              <li key={c.signalId} className="flex flex-wrap items-center gap-2">
                <span className={`w-12 text-right tabular-nums ${c.value >= 0 ? "text-sky-700 dark:text-sky-400" : "text-rose-700 dark:text-rose-400"}`}>
                  {c.value >= 0 ? "+" : ""}
                  {c.value.toFixed(2)}
                </span>
                <span className="min-w-0 flex-1">{sig.title}</span>
                <span className="text-xs text-zinc-500">{c.via === "direct" ? s.nameRole : `${s.viaSkill} ${data.skillNames[c.via]}`}</span>
                <SourceChip signal={sig} />
              </li>
            );
          })}
        </ul>
        <p className="mt-2 text-xs text-zinc-500">
          {s.roleSource}:{" "}
          <a href={role.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">
            {role.sourceName}
          </a>
        </p>
      </details>
    </article>
  );
}

function InterestCompare({ s, user, role, source }: { s: Strings; user: RiasecScores; role: RiasecScores; source: string | null }) {
  const shared = sharedTopTypes(user, role);
  const names = (types: string[]) => types.map((t) => TYPE_INFO[t as keyof typeof TYPE_INFO].en).join(" & ");
  return (
    <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
      <RiasecHexagon user={user} role={role} />
      <div className="min-w-0 flex-1">
        <p>
          <span className="text-emerald-700 dark:text-emerald-400">■</span> {s.riasecYou}: <strong>{riasecCode(user)}</strong> ·{" "}
          <span className="text-sky-700 dark:text-sky-400">■</span> {s.riasecRole}: <strong>{riasecCode(role)}</strong>
        </p>
        <p className="mt-1 text-zinc-700 dark:text-zinc-300">
          {shared.length > 0 ? fmt(s.interestShared, { types: names(shared) }) : s.interestDiffer}
        </p>
        {source && <p className="mt-1 text-xs text-zinc-500">{source}</p>}
      </div>
    </div>
  );
}

/** Two RIASEC profiles on a hexagon: the person (green) and the role (blue). */
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
        <polygon key={k} points={RIASEC_TYPES.map((_, i) => point(i, k).join(",")).join(" ")} className="fill-none stroke-zinc-300 dark:stroke-zinc-700" />
      ))}
      <polygon points={poly(role)} className="fill-sky-500/20 stroke-sky-600" strokeWidth={1.5} />
      <polygon points={poly(user)} className="fill-emerald-500/20 stroke-emerald-600" strokeWidth={1.5} />
      {RIASEC_TYPES.map((t, i) => {
        const [x, y] = point(i, 1.25);
        return (
          <text key={t} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="fill-zinc-500 text-[10px]">
            {t}
          </text>
        );
      })}
    </svg>
  );
}

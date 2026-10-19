import { createHash } from "node:crypto";
import { asc } from "drizzle-orm";
import { getSkillSimilarity, type SkillSimilarity } from "../embeddings";
import { roleSkills, roles, scenarios, signals, skills, type ExtractedProfile } from "../db/schema";
import type { AnyDb } from "../db/types";
import { interestFit, type RiasecScores } from "../riasec";
import {
  roleContributions,
  roleDemand,
  skillMatch,
  skillOutlook,
  type Confidence,
  type Contribution,
  type EngineSignal,
  type SkillMatch,
} from "./engine";

const MAX_CONTRIBUTIONS_SHOWN = 8;

type RoleRow = typeof roles.$inferSelect;
type SignalRow = typeof signals.$inferSelect;
type ScenarioRow = typeof scenarios.$inferSelect;

export type ScenarioDemand = {
  normalized: number;
  raw: number;
  baseRaw: number;
  multiplier: number;
  confidence: Confidence;
  agreement: number;
  band: number;
};

export type RoleResult = {
  id: number;
  slug: string;
  title: string;
  sector: string;
  outlook: "emerging" | "declining";
  aiExposure: "low" | "medium" | "high";
  sdgIds: number[];
  sdgTargets: string[];
  sdgReason: string;
  sourceName: string;
  sourceUrl: string;
  riasec: RiasecScores | null;
  riasecCode: string | null;
  riasecSource: string | null;
  /** Interest fit 0..1 from the person's quiz; null if the quiz was skipped. */
  interest: number | null;
  skill: SkillMatch;
  demand: Record<string, ScenarioDemand>;
  signalCount: number;
  contributions: Contribution[]; // strongest first, capped
};

/** Everything that doesn't depend on the person: loaded and computed once, reused per profile. */
export type ScoringContext = {
  asOf: Date;
  roles: RoleRow[];
  roleSkills: (typeof roleSkills.$inferSelect)[];
  skills: { id: number; slug: string; name: string }[];
  signals: SignalRow[];
  scenarios: ScenarioRow[];
  similarity: SkillSimilarity;
  /** Hash of the signal set; changes whenever a signal is added, removed or re-tagged. */
  signalsVersion: string;
  lastUpdated: Date | null;
  contributions: Map<number, Contribution[]>;
  demand: Map<number, Record<string, ScenarioDemand>>;
  skillsOutlook: { skillId: number; name: string; value: number; signalIds: number[] }[];
};

export function computeSignalsVersion(rows: Pick<SignalRow, "id" | "direction" | "strength" | "publishedDate" | "roleIds" | "skillIds">[]): string {
  const canonical = [...rows]
    .sort((a, b) => a.id - b.id)
    .map((s) => `${s.id}:${s.direction}:${s.strength}:${s.publishedDate}:${[...s.roleIds].sort((x, y) => x - y)}:${[...s.skillIds].sort((x, y) => x - y)}`)
    .join("|");
  return createHash("sha1").update(canonical).digest("hex").slice(0, 12);
}

export async function loadScoringContext(db: AnyDb, asOf = new Date()): Promise<ScoringContext> {
  const [roleRows, roleSkillRows, skillRows, signalRows, scenarioRows] = await Promise.all([
    db.select().from(roles).orderBy(asc(roles.id)),
    db.select().from(roleSkills),
    db.select({ id: skills.id, slug: skills.slug, name: skills.name }).from(skills),
    db.select().from(signals),
    db.select().from(scenarios).orderBy(asc(scenarios.aiAdoptionMultiplier)),
  ]);

  const engineSignals: EngineSignal[] = signalRows.map((s) => ({
    id: s.id,
    publishedDate: s.publishedDate,
    direction: s.direction,
    strength: s.strength,
    roleIds: s.roleIds,
    skillIds: s.skillIds,
    fromFeed: s.taggedBy !== "curated",
  }));

  const contributions = new Map<number, Contribution[]>();
  const demand = new Map<number, Record<string, ScenarioDemand>>();
  for (const r of roleRows) {
    const c = roleContributions(r.id, roleSkillRows, engineSignals, asOf);
    contributions.set(r.id, c);
    const perScenario: Record<string, ScenarioDemand> = {};
    for (const sc of scenarioRows) {
      const d = roleDemand({ id: r.id, aiExposure: r.aiExposure }, c, sc);
      perScenario[sc.key] = {
        normalized: d.normalized,
        raw: d.raw,
        baseRaw: d.baseRaw,
        multiplier: d.multiplier,
        confidence: d.confidence,
        agreement: d.agreement,
        band: d.band,
      };
    }
    demand.set(r.id, perScenario);
  }

  const skillNames = new Map(skillRows.map((s) => [s.id, s.name]));
  const skillsOutlookList = [...skillOutlook(engineSignals, asOf).entries()]
    .map(([skillId, o]) => ({ skillId, name: skillNames.get(skillId) ?? `#${skillId}`, value: o.value, signalIds: o.signalIds }))
    .sort((a, b) => b.value - a.value);

  const lastUpdated = signalRows.reduce<Date | null>((m, s) => (!m || s.fetchedAt > m ? s.fetchedAt : m), null);

  return {
    asOf,
    roles: roleRows,
    roleSkills: roleSkillRows,
    skills: skillRows,
    signals: signalRows,
    scenarios: scenarioRows,
    similarity: await getSkillSimilarity(skillRows),
    signalsVersion: computeSignalsVersion(signalRows),
    lastUpdated,
    contributions,
    demand,
    skillsOutlook: skillsOutlookList,
  };
}

export type ProfileSkillRef = { skillId: number; name: string; level: number };

/** Maps an extracted profile's skill slugs to catalog ids, dropping anything not in the catalog. */
export function profileSkillsFor(ctx: ScoringContext, profile: ExtractedProfile): ProfileSkillRef[] {
  const bySlug = new Map(ctx.skills.map((s) => [s.slug, s]));
  return profile.skills.flatMap((s) => {
    const skill = bySlug.get(s.slug);
    return skill ? [{ skillId: skill.id, name: skill.name, level: s.level }] : [];
  });
}

export function scoreProfile(ctx: ScoringContext, profileSkills: ProfileSkillRef[], riasec: RiasecScores | null): RoleResult[] {
  return ctx.roles.map((r) => {
    const contributions = ctx.contributions.get(r.id) ?? [];
    return {
      id: r.id,
      slug: r.slug,
      title: r.title,
      sector: r.sector,
      outlook: r.outlook,
      aiExposure: r.aiExposure,
      sdgIds: r.sdgIds,
      sdgTargets: r.sdgTargets,
      sdgReason: r.sdgReason,
      sourceName: r.sourceName,
      sourceUrl: r.sourceUrl,
      riasec: r.riasec,
      riasecCode: r.riasecCode,
      riasecSource: r.riasecSource,
      interest: riasec && r.riasec ? interestFit(riasec, r.riasec) : null,
      skill: skillMatch(r.id, ctx.roleSkills, profileSkills, ctx.similarity),
      demand: ctx.demand.get(r.id) ?? {},
      signalCount: contributions.length,
      contributions: contributions.slice(0, MAX_CONTRIBUTIONS_SHOWN),
    };
  });
}

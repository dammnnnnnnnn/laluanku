import { asc, eq, max, or } from "drizzle-orm";
import { getSkillSimilarity, type SimilarityMethod } from "../embeddings";
import { profiles, roleSkills, roles, scenarios, signals, skills } from "../db/schema";
import type { AnyDb } from "../db/types";
import { interestFit, type RiasecScores } from "../riasec";
import { DEFAULT_WEIGHTS } from "./config";
import {
  roleContributions,
  roleDemand,
  skillMatch,
  skillOutlook,
  type Confidence,
  type Contribution,
  type SkillMatch,
  type Weights,
} from "./engine";

export const DEFAULT_SAMPLE = "siti-admin-returner";
const MAX_CONTRIBUTIONS_SHOWN = 8;

export type SignalRef = {
  id: number;
  title: string;
  sourceName: string;
  sourceType: string;
  publishedDate: string;
  url: string;
  direction: "emerging" | "declining";
  strength: number;
  taggedBy: string;
};

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
  /** Interest fit 0..1 from the user's quiz; null if the quiz was skipped. */
  interest: number | null;
  skill: SkillMatch;
  demand: Record<string, ScenarioDemand>;
  signalCount: number;
  contributions: Contribution[]; // strongest first, capped
};

export type ResultsData = {
  asOf: string;
  lastUpdated: string | null;
  similarityMethod: SimilarityMethod;
  profile: {
    id: number;
    sampleKey: string | null;
    displayName: string;
    headline: string;
    isSample: boolean;
    skills: { skillId: number; name: string; level: number }[];
    hasInterest: boolean;
    riasec: RiasecScores | null;
  };
  samples: { key: string; displayName: string; headline: string }[];
  scenarios: { key: string; name: string; description: string; notes: string; multiplier: number }[];
  defaultWeights: Weights;
  roles: RoleResult[];
  skillsOutlook: { skillId: number; name: string; value: number; signalIds: number[] }[];
  skillNames: Record<number, string>;
  signals: Record<number, SignalRef>;
};

/** Loads everything /results needs for one profile: a sample key, or a saved profile's public id. */
export async function loadResults(db: AnyDb, profileRef: string, asOf = new Date()): Promise<ResultsData | null> {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(or(eq(profiles.sampleKey, profileRef), eq(profiles.publicId, profileRef)))
    .limit(1);
  if (!profile) return null;

  const [sampleRows, roleRows, roleSkillRows, skillRows, signalRows, scenarioRows, [{ lastUpdated }]] = await Promise.all([
    db.select({ key: profiles.sampleKey, json: profiles.extractedJson }).from(profiles).where(eq(profiles.isSample, true)).orderBy(asc(profiles.id)),
    db.select().from(roles).orderBy(asc(roles.id)),
    db.select().from(roleSkills),
    db.select({ id: skills.id, slug: skills.slug, name: skills.name }).from(skills),
    db.select().from(signals),
    db.select().from(scenarios).orderBy(asc(scenarios.aiAdoptionMultiplier)),
    db.select({ lastUpdated: max(signals.fetchedAt) }).from(signals),
  ]);

  const skillBySlug = new Map(skillRows.map((s) => [s.slug, s]));
  const skillNames = Object.fromEntries(skillRows.map((s) => [s.id, s.name]));
  const profileSkills = profile.extractedJson.skills
    .map((s) => ({ skill: skillBySlug.get(s.slug), level: s.level }))
    .filter((s): s is { skill: (typeof skillRows)[number]; level: 1 | 2 | 3 } => Boolean(s.skill))
    .map((s) => ({ skillId: s.skill.id, name: s.skill.name, level: s.level }));

  const similarity = await getSkillSimilarity(skillRows);
  const engineSignals = signalRows.map((s) => ({
    id: s.id,
    publishedDate: s.publishedDate,
    direction: s.direction,
    strength: s.strength,
    roleIds: s.roleIds,
    skillIds: s.skillIds,
  }));

  const roleResults: RoleResult[] = roleRows.map((r) => {
    const contributions = roleContributions(r.id, roleSkillRows, engineSignals, asOf);
    const demand: Record<string, ScenarioDemand> = {};
    for (const sc of scenarioRows) {
      const d = roleDemand({ id: r.id, aiExposure: r.aiExposure }, contributions, sc);
      demand[sc.key] = {
        normalized: d.normalized,
        raw: d.raw,
        baseRaw: d.baseRaw,
        multiplier: d.multiplier,
        confidence: d.confidence,
        agreement: d.agreement,
        band: d.band,
      };
    }
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
      interest: profile.riasec && r.riasec ? interestFit(profile.riasec, r.riasec) : null,
      skill: skillMatch(r.id, roleSkillRows, profileSkills, similarity),
      demand,
      signalCount: contributions.length,
      contributions: contributions.slice(0, MAX_CONTRIBUTIONS_SHOWN),
    };
  });

  const outlook = skillOutlook(engineSignals, asOf);
  const skillsOutlook = [...outlook.entries()]
    .map(([skillId, o]) => ({ skillId, name: skillNames[skillId] ?? `#${skillId}`, value: o.value, signalIds: o.signalIds }))
    .sort((a, b) => b.value - a.value);

  // Only ship the signals the page can reference.
  const referenced = new Set<number>([
    ...roleResults.flatMap((r) => r.contributions.map((c) => c.signalId)),
    ...skillsOutlook.flatMap((s) => s.signalIds),
  ]);
  const signalRefs: Record<number, SignalRef> = {};
  for (const s of signalRows) {
    if (!referenced.has(s.id)) continue;
    signalRefs[s.id] = {
      id: s.id,
      title: s.title,
      sourceName: s.sourceName,
      sourceType: s.sourceType,
      publishedDate: s.publishedDate,
      url: s.url,
      direction: s.direction,
      strength: s.strength,
      taggedBy: s.taggedBy,
    };
  }

  const hasInterest = profile.riasec !== null;
  return {
    asOf: asOf.toISOString(),
    lastUpdated: lastUpdated ? lastUpdated.toISOString() : null,
    similarityMethod: similarity.method,
    profile: {
      id: profile.id,
      sampleKey: profile.sampleKey,
      displayName: profile.extractedJson.displayName,
      headline: profile.extractedJson.headline,
      isSample: profile.isSample,
      skills: profileSkills,
      hasInterest,
      riasec: profile.riasec,
    },
    samples: sampleRows
      .filter((s): s is { key: string; json: typeof s.json } => Boolean(s.key))
      .map((s) => ({ key: s.key, displayName: s.json.displayName, headline: s.json.headline })),
    scenarios: scenarioRows.map((s) => ({ key: s.key, name: s.name, description: s.description, notes: s.notes, multiplier: s.aiAdoptionMultiplier })),
    defaultWeights: { ...(hasInterest ? DEFAULT_WEIGHTS.withInterest : DEFAULT_WEIGHTS.withoutInterest) },
    roles: roleResults,
    skillsOutlook,
    skillNames,
    signals: signalRefs,
  };
}

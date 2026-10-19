import { asc, eq, or } from "drizzle-orm";
import type { SimilarityMethod } from "../embeddings";
import { profiles } from "../db/schema";
import type { AnyDb } from "../db/types";
import type { RiasecScores } from "../riasec";
import { loadScoringContext, profileSkillsFor, scoreProfile, type RoleResult } from "./context";
import type { Weights } from "./engine";
import { defaultWeightsFor, ensureSnapshots, loadChanges, type ScenarioChanges } from "./snapshots";

export type { RoleResult, ScenarioDemand } from "./context";
export type { ScenarioChanges } from "./snapshots";

export const DEFAULT_SAMPLE = "siti-admin-returner";

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

export type ResultsData = {
  asOf: string;
  lastUpdated: string | null;
  signalsVersion: string;
  similarityMethod: SimilarityMethod;
  profile: {
    id: number;
    sampleKey: string | null;
    /** The reference used in links: the sample key or the public id. */
    ref: string;
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
  /** Per scenario: what changed since the last ranking on a different signal set (null if none yet). */
  changes: Record<string, ScenarioChanges | null>;
};

/** Loads everything /results needs for one profile: a sample key, or a saved profile's public id. */
export async function loadResults(db: AnyDb, profileRef: string, asOf = new Date()): Promise<ResultsData | null> {
  const [profile] = await db
    .select()
    .from(profiles)
    .where(or(eq(profiles.sampleKey, profileRef), eq(profiles.publicId, profileRef)))
    .limit(1);
  if (!profile) return null;

  const [ctx, sampleRows] = await Promise.all([
    loadScoringContext(db, asOf),
    db.select({ key: profiles.sampleKey, json: profiles.extractedJson }).from(profiles).where(eq(profiles.isSample, true)).orderBy(asc(profiles.id)),
  ]);

  const profileSkills = profileSkillsFor(ctx, profile.extractedJson);
  const roles = scoreProfile(ctx, profileSkills, profile.riasec);
  const weights = defaultWeightsFor(profile.riasec);

  // Diff against the previous signal set first, then record the current one if it's new.
  const changes = await loadChanges(db, ctx, profile.id, roles, weights);
  await ensureSnapshots(db, ctx, profile.id, roles, weights);

  const skillNames = Object.fromEntries(ctx.skills.map((s) => [s.id, s.name]));

  // Only ship the signals the page can reference.
  const referenced = new Set<number>([
    ...roles.flatMap((r) => r.contributions.map((c) => c.signalId)),
    ...ctx.skillsOutlook.flatMap((s) => s.signalIds),
    ...Object.values(changes).flatMap((c) => (c ? Object.values(c.newSignalsByRole).flat() : [])),
  ]);
  const signalRefs: Record<number, SignalRef> = {};
  for (const s of ctx.signals) {
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

  return {
    asOf: asOf.toISOString(),
    lastUpdated: ctx.lastUpdated ? ctx.lastUpdated.toISOString() : null,
    signalsVersion: ctx.signalsVersion,
    similarityMethod: ctx.similarity.method,
    profile: {
      id: profile.id,
      sampleKey: profile.sampleKey,
      ref: profile.sampleKey ?? profile.publicId ?? profileRef,
      displayName: profile.extractedJson.displayName,
      headline: profile.extractedJson.headline,
      isSample: profile.isSample,
      skills: profileSkills,
      hasInterest: profile.riasec !== null,
      riasec: profile.riasec,
    },
    samples: sampleRows
      .filter((s): s is { key: string; json: typeof s.json } => Boolean(s.key))
      .map((s) => ({ key: s.key, displayName: s.json.displayName, headline: s.json.headline })),
    scenarios: ctx.scenarios.map((s) => ({ key: s.key, name: s.name, description: s.description, notes: s.notes, multiplier: s.aiAdoptionMultiplier })),
    defaultWeights: weights,
    roles,
    skillsOutlook: ctx.skillsOutlook,
    skillNames,
    signals: signalRefs,
    changes,
  };
}

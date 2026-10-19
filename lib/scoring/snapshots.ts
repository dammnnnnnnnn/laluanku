// Ranking snapshots: a stored copy of a profile's ranking for each signals version, so the
// app can show what changed after new signals arrive.
import { and, desc, eq, gte, isNotNull, ne, or } from "drizzle-orm";
import { profiles, rankingSnapshots, type ExtractedProfile, type Riasec } from "../db/schema";
import type { AnyDb } from "../db/types";
import { DEFAULT_WEIGHTS } from "./config";
import { profileSkillsFor, scoreProfile, type RoleResult, type ScoringContext, loadScoringContext } from "./context";
import { buildRanking, diffRankings, type RankingDiff, type SnapshotRanking } from "./diff";
import type { Weights } from "./engine";

const RECENT_PROFILE_DAYS = 30;
const MAX_PROFILES_PER_RUN = 100;

export function defaultWeightsFor(riasec: Riasec | null): Weights {
  return { ...(riasec ? DEFAULT_WEIGHTS.withInterest : DEFAULT_WEIGHTS.withoutInterest) };
}

function currentRankings(ctx: ScoringContext, roles: RoleResult[], weights: Weights): Record<string, SnapshotRanking> {
  const signalIds = ctx.signals.map((s) => s.id);
  return Object.fromEntries(ctx.scenarios.map((sc) => [sc.key, buildRanking(roles, sc.key, weights, signalIds)]));
}

/** Stores a snapshot per scenario unless the latest one already has the current signals version. */
export async function ensureSnapshots(db: AnyDb, ctx: ScoringContext, profileId: number, roles: RoleResult[], weights: Weights): Promise<number> {
  const rankings = currentRankings(ctx, roles, weights);
  let created = 0;
  for (const sc of ctx.scenarios) {
    const [latest] = await db
      .select({ version: rankingSnapshots.signalsVersion })
      .from(rankingSnapshots)
      .where(and(eq(rankingSnapshots.profileId, profileId), eq(rankingSnapshots.scenarioKey, sc.key)))
      .orderBy(desc(rankingSnapshots.computedAt), desc(rankingSnapshots.id))
      .limit(1);
    if (latest?.version === ctx.signalsVersion) continue;
    await db.insert(rankingSnapshots).values({
      profileId,
      scenarioKey: sc.key,
      signalsVersion: ctx.signalsVersion,
      ranking: rankings[sc.key],
    });
    created++;
  }
  return created;
}

export type ScenarioChanges = RankingDiff & {
  /** For each changed role, the new signals that feed its demand score. */
  newSignalsByRole: Record<number, number[]>;
};

/** Diff of the current ranking against the most recent snapshot taken with a different signals version. */
export async function loadChanges(
  db: AnyDb,
  ctx: ScoringContext,
  profileId: number,
  roles: RoleResult[],
  weights: Weights,
): Promise<Record<string, ScenarioChanges | null>> {
  const rankings = currentRankings(ctx, roles, weights);
  const out: Record<string, ScenarioChanges | null> = {};
  for (const sc of ctx.scenarios) {
    const [prev] = await db
      .select()
      .from(rankingSnapshots)
      .where(
        and(
          eq(rankingSnapshots.profileId, profileId),
          eq(rankingSnapshots.scenarioKey, sc.key),
          ne(rankingSnapshots.signalsVersion, ctx.signalsVersion),
        ),
      )
      .orderBy(desc(rankingSnapshots.computedAt), desc(rankingSnapshots.id))
      .limit(1);
    if (!prev) {
      out[sc.key] = null;
      continue;
    }
    const diff = diffRankings(prev.ranking as SnapshotRanking, rankings[sc.key], prev.computedAt);
    const fresh = new Set(diff.newSignalIds);
    const newSignalsByRole: Record<number, number[]> = {};
    for (const change of diff.changes) {
      const ids = (ctx.contributions.get(change.roleId) ?? []).filter((c) => fresh.has(c.signalId)).map((c) => c.signalId);
      if (ids.length) newSignalsByRole[change.roleId] = ids;
    }
    out[sc.key] = { ...diff, newSignalsByRole };
  }
  return out;
}

/**
 * Makes sure sample profiles and recently created profiles have a snapshot of the current
 * signal set. Run before a refresh (baseline) and after it (new version).
 */
export async function snapshotProfiles(db: AnyDb, ctx?: ScoringContext): Promise<{ profiles: number; created: number }> {
  const context = ctx ?? (await loadScoringContext(db));
  const since = new Date(Date.now() - RECENT_PROFILE_DAYS * 86_400_000);
  const rows = await db
    .select({ id: profiles.id, json: profiles.extractedJson, riasec: profiles.riasec })
    .from(profiles)
    .where(or(eq(profiles.isSample, true), and(isNotNull(profiles.publicId), gte(profiles.createdAt, since))))
    .orderBy(desc(profiles.createdAt))
    .limit(MAX_PROFILES_PER_RUN);

  let created = 0;
  for (const p of rows) {
    const roles = scoreProfile(context, profileSkillsFor(context, p.json as ExtractedProfile), p.riasec);
    created += await ensureSnapshots(db, context, p.id, roles, defaultWeightsFor(p.riasec));
  }
  return { profiles: rows.length, created };
}

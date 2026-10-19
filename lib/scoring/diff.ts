// Ranking snapshots and the "what changed" diff between two of them. Pure functions.
import { finalScore, type Weights } from "./engine";

export type SnapshotRole = {
  roleId: number;
  /** Rank among emerging roles with default weights (null for declining roles). */
  rank: number | null;
  score: number;
  skill: number;
  demand: number;
};

export type SnapshotRanking = {
  signalIds: number[];
  weights: Weights;
  roles: SnapshotRole[];
};

type RankableRole = {
  id: number;
  outlook: "emerging" | "declining";
  skill: { score: number };
  interest: number | null;
  demand: Record<string, { normalized: number }>;
};

export function buildRanking(roles: RankableRole[], scenarioKey: string, weights: Weights, signalIds: number[]): SnapshotRanking {
  const scored = roles.map((r) => {
    const demand = r.demand[scenarioKey]?.normalized ?? 0.5;
    return {
      roleId: r.id,
      outlook: r.outlook,
      score: finalScore({ skill: r.skill.score, demand, interest: r.interest }, weights),
      skill: r.skill.score,
      demand,
    };
  });
  const emergingOrder = scored
    .filter((r) => r.outlook === "emerging")
    .sort((a, b) => b.score - a.score || a.roleId - b.roleId)
    .map((r) => r.roleId);
  const rankOf = new Map(emergingOrder.map((id, i) => [id, i + 1]));
  return {
    signalIds: [...signalIds].sort((a, b) => a - b),
    weights,
    roles: scored.map(({ roleId, score, skill, demand }) => ({ roleId, rank: rankOf.get(roleId) ?? null, score, skill, demand })),
  };
}

export type RoleChange = {
  roleId: number;
  prevRank: number | null;
  currRank: number | null;
  scoreDelta: number;
  demandDelta: number;
};

export type RankingDiff = {
  prevComputedAt: string;
  newSignalIds: number[];
  removedSignalCount: number;
  /** Roles in the current or previous top N, ordered by current rank. */
  changes: RoleChange[];
};

export function diffRankings(prev: SnapshotRanking, curr: SnapshotRanking, prevComputedAt: Date, topN = 5): RankingDiff {
  const prevIds = new Set(prev.signalIds);
  const currIds = new Set(curr.signalIds);
  const prevByRole = new Map(prev.roles.map((r) => [r.roleId, r]));
  const currByRole = new Map(curr.roles.map((r) => [r.roleId, r]));
  const inTop = (r: SnapshotRole | undefined) => r?.rank != null && r.rank <= topN;

  const roleIds = new Set([...curr.roles.filter(inTop).map((r) => r.roleId), ...prev.roles.filter(inTop).map((r) => r.roleId)]);
  const changes: RoleChange[] = [...roleIds].map((roleId) => {
    const p = prevByRole.get(roleId);
    const c = currByRole.get(roleId);
    return {
      roleId,
      prevRank: p?.rank ?? null,
      currRank: c?.rank ?? null,
      scoreDelta: (c?.score ?? 0) - (p?.score ?? 0),
      demandDelta: (c?.demand ?? 0) - (p?.demand ?? 0),
    };
  });
  changes.sort((a, b) => (a.currRank ?? Infinity) - (b.currRank ?? Infinity) || (a.prevRank ?? Infinity) - (b.prevRank ?? Infinity));

  return {
    prevComputedAt: prevComputedAt.toISOString(),
    newSignalIds: curr.signalIds.filter((id) => !prevIds.has(id)),
    removedSignalCount: prev.signalIds.filter((id) => !currIds.has(id)).length,
    changes,
  };
}

/** The change worth a headline: the biggest rank gain inside the current top 3, else the biggest move. */
export function headlineChange(diff: RankingDiff): RoleChange | null {
  const moved = diff.changes.filter((c) => c.prevRank !== c.currRank && c.currRank !== null);
  if (moved.length === 0) return null;
  const gain = (c: RoleChange) => (c.prevRank ?? 99) - (c.currRank ?? 99);
  const top3Gainers = moved.filter((c) => (c.currRank ?? 99) <= 3 && gain(c) > 0).sort((a, b) => gain(b) - gain(a));
  return top3Gainers[0] ?? [...moved].sort((a, b) => Math.abs(gain(b)) - Math.abs(gain(a)))[0];
}

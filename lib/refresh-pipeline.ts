import type { AnyDb } from "./db/types";
import { snapshotProfiles } from "./scoring/snapshots";
import { refreshSignals, type RefreshSummary } from "./signals/refresh";

export type PipelineSummary = RefreshSummary & { snapshots: { profiles: number; created: number } };

/**
 * Refresh signals and recompute rankings:
 * 1. snapshot every tracked profile on the current signals (the "before" baseline),
 * 2. pull and tag new signals,
 * 3. if anything was accepted, snapshot again so /results can show what changed.
 */
export async function runRefreshPipeline(db: AnyDb): Promise<PipelineSummary> {
  const before = await snapshotProfiles(db);
  const summary = await refreshSignals(db);
  const after = summary.accepted > 0 ? await snapshotProfiles(db) : { profiles: before.profiles, created: 0 };
  return { ...summary, snapshots: after };
}

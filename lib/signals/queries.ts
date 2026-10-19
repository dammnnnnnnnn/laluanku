import { desc, max } from "drizzle-orm";
import { roles, signalRefreshRuns, signals, skills } from "../db/schema";
import type { AnyDb } from "../db/types";

export async function getSignalsPageData(db: AnyDb) {
  const [signalRows, roleRows, skillRows, runs, [{ lastFetched }]] = await Promise.all([
    db.select().from(signals).orderBy(desc(signals.publishedDate), desc(signals.id)),
    db.select({ id: roles.id, title: roles.title }).from(roles),
    db.select({ id: skills.id, name: skills.name }).from(skills),
    db.select().from(signalRefreshRuns).orderBy(desc(signalRefreshRuns.startedAt)).limit(5),
    db.select({ lastFetched: max(signals.fetchedAt) }).from(signals),
  ]);

  const roleName = new Map(roleRows.map((r) => [r.id, r.title]));
  const skillName = new Map(skillRows.map((s) => [s.id, s.name]));

  return {
    signals: signalRows.map((s) => ({
      ...s,
      roles: s.roleIds.map((id) => roleName.get(id)).filter((n): n is string => Boolean(n)),
      skills: s.skillIds.map((id) => skillName.get(id)).filter((n): n is string => Boolean(n)),
    })),
    runs,
    lastFetched,
    lastGoodRun: runs.find((r) => r.status === "ok" || r.status === "partial") ?? null,
  };
}

export type SignalsPageData = Awaited<ReturnType<typeof getSignalsPageData>>;

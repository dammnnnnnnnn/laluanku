// Data for the landing page: catalog counts, the latest signals for the live feed,
// the skills outlook (Future Skills Radar) and which SDGs our catalog links to.
import { count, desc } from "drizzle-orm";
import type { AnyDb } from "./db/types";
import { courses, roles, signalRefreshRuns, signals, skills } from "./db/schema";
import { skillOutlook } from "./scoring/engine";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export type HomeSignal = {
  id: number;
  title: string;
  direction: "emerging" | "declining";
  sourceName: string;
  publishedDate: string;
  roles: string[];
};

export type HomeData = {
  counts: { roles: number; signals: number; courses: number };
  feed: HomeSignal[];
  newThisWeek: number;
  lastFetched: Date | null;
  rising: { name: string; value: number }[];
  declining: { name: string; value: number }[];
  linkedGoals: number[];
};

export async function loadHomeData(db: AnyDb, asOf = new Date()): Promise<HomeData> {
  const [signalRows, roleRows, skillRows, [courseCount], lastRuns] = await Promise.all([
    db.select().from(signals).orderBy(desc(signals.fetchedAt), desc(signals.publishedDate), desc(signals.id)),
    db.select({ id: roles.id, title: roles.title, outlook: roles.outlook, sdgIds: roles.sdgIds }).from(roles),
    db.select({ id: skills.id, name: skills.name, sdgIds: skills.sdgIds }).from(skills),
    db.select({ n: count() }).from(courses),
    db.select({ finishedAt: signalRefreshRuns.finishedAt }).from(signalRefreshRuns).orderBy(desc(signalRefreshRuns.startedAt)).limit(1),
  ]);

  const roleName = new Map(roleRows.map((r) => [r.id, r.title]));
  const skillName = new Map(skillRows.map((s) => [s.id, s.name]));
  const outlook = [...skillOutlook(signalRows.map((s) => ({ ...s, fromFeed: s.taggedBy !== "curated" })), asOf).entries()]
    .map(([id, o]) => ({ name: skillName.get(id) ?? `#${id}`, value: o.value }))
    .sort((a, b) => b.value - a.value);

  const lastFetched = signalRows.reduce<Date | null>((m, s) => (!m || s.fetchedAt > m ? s.fetchedAt : m), lastRuns[0]?.finishedAt ?? null);

  return {
    counts: { roles: roleRows.filter((r) => r.outlook === "emerging").length, signals: signalRows.length, courses: courseCount.n },
    feed: signalRows.slice(0, 8).map((s) => ({
      id: s.id,
      title: s.title,
      direction: s.direction,
      sourceName: s.sourceName,
      publishedDate: s.publishedDate,
      roles: s.roleIds.map((id) => roleName.get(id)).filter((n): n is string => Boolean(n)),
    })),
    newThisWeek: signalRows.filter((s) => asOf.getTime() - s.fetchedAt.getTime() < WEEK_MS).length,
    lastFetched,
    rising: outlook.filter((o) => o.value > 0).slice(0, 5),
    declining: outlook.filter((o) => o.value < 0).reverse().slice(0, 5),
    linkedGoals: [...new Set([...roleRows, ...skillRows].flatMap((x) => x.sdgIds))].sort((a, b) => a - b),
  };
}

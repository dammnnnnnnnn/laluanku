import { and, desc, eq, gt, gte, inArray } from "drizzle-orm";
import { feedItems, roles, signalRefreshRuns, signals, skills, type FeedRunResult } from "../db/schema";
import type { AnyDb } from "../db/types";
import { FEEDS, type FeedConfig } from "./feeds";
import { fetchFeed, type FeedItem } from "./fetch";
import { applyGuardrails } from "./guardrails";
import { ClaudeTagger, hasAnthropicCredentials } from "./tag-claude";
import { KeywordTagger } from "./tag-keyword";
import type { Catalog, Tagger } from "./types";

const MAX_NEW_ITEMS_PER_RUN = 40;
const STALE_RUN_MS = 15 * 60_000;

export class RefreshInProgressError extends Error {
  constructor() {
    super("A signal refresh is already running. Try again in a few minutes.");
  }
}

export type RefreshSummary = {
  runId: number;
  status: "ok" | "partial" | "failed";
  tagger: Tagger["name"];
  model: string | null;
  feeds: FeedRunResult[];
  checked: number;
  accepted: number;
  rejected: number;
  failed: number;
  newSignals: { id: number; title: string; direction: string }[];
};

export function defaultTagger(): Tagger {
  return hasAnthropicCredentials() ? new ClaudeTagger() : new KeywordTagger();
}

async function loadCatalog(db: AnyDb): Promise<Catalog> {
  const [roleRows, skillRows] = await Promise.all([
    db.select({ id: roles.id, slug: roles.slug, title: roles.title, sector: roles.sector, outlook: roles.outlook }).from(roles),
    db.select({ id: skills.id, slug: skills.slug, name: skills.name, category: skills.category }).from(skills),
  ]);
  return { roles: roleRows, skills: skillRows };
}

/** Items not seen before. Failed items are retried; accepted/rejected ones are not. */
async function unseen(db: AnyDb, items: FeedItem[]): Promise<FeedItem[]> {
  const unique = [...new Map(items.map((i) => [i.externalId, i])).values()];
  if (unique.length === 0) return [];
  const ids = unique.map((i) => i.externalId);
  const [seen, existing] = await Promise.all([
    db
      .select({ id: feedItems.externalId })
      .from(feedItems)
      .where(and(inArray(feedItems.externalId, ids), inArray(feedItems.status, ["accepted", "rejected"]))),
    db.select({ id: signals.externalId }).from(signals).where(inArray(signals.externalId, ids)),
  ]);
  const skip = new Set([...seen, ...existing].map((r) => r.id));
  return unique.filter((i) => !skip.has(i.externalId));
}

const STOPWORDS = new Set(["the", "and", "for", "with", "from", "says", "said", "its", "into", "over", "will", "has", "have", "are", "was"]);

function titleTokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

// The same story often arrives from several outlets with reworded headlines.
function isNearDuplicate(a: Set<string>, b: Set<string>): boolean {
  const smaller = Math.min(a.size, b.size);
  if (smaller < 4) return false;
  let shared = 0;
  for (const w of a) if (b.has(w)) shared++;
  return shared / smaller >= 0.6;
}

/**
 * Pulls every configured feed, tags new items (Claude, or the keyword fallback without
 * credentials), applies guardrails and stores accepted items as signals.
 * Every run is recorded in signal_refresh_runs; if all feeds fail, existing signals stay as they are.
 */
export async function refreshSignals(
  db: AnyDb,
  options: { feeds?: FeedConfig[]; tagger?: Tagger } = {},
): Promise<RefreshSummary> {
  const feeds = options.feeds ?? FEEDS;
  const tagger = options.tagger ?? defaultTagger();

  const [running] = await db
    .select({ id: signalRefreshRuns.id })
    .from(signalRefreshRuns)
    .where(and(eq(signalRefreshRuns.status, "running"), gt(signalRefreshRuns.startedAt, new Date(Date.now() - STALE_RUN_MS))))
    .orderBy(desc(signalRefreshRuns.startedAt))
    .limit(1);
  if (running) throw new RefreshInProgressError();

  const [run] = await db
    .insert(signalRefreshRuns)
    .values({ tagger: tagger.name, model: tagger.model })
    .returning({ id: signalRefreshRuns.id });

  try {
    const settled = await Promise.allSettled(feeds.map((f) => fetchFeed(f)));
    const feedResults: FeedRunResult[] = feeds.map((f, i) => {
      const r = settled[i];
      return r.status === "fulfilled"
        ? { key: f.key, name: f.name, ok: true, items: r.value.length }
        : { key: f.key, name: f.name, ok: false, items: 0, error: r.reason instanceof Error ? r.reason.message : String(r.reason) };
    });
    const fetched = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

    const candidates = (await unseen(db, fetched)).sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));

    // Drop near-duplicates of each other and of signals from the last 90 days before tagging.
    const since = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    const recent = await db.select({ title: signals.title }).from(signals).where(gte(signals.publishedDate, since));
    const known = recent.map((r) => ({ title: r.title, tokens: titleTokens(r.title) }));
    const fresh: FeedItem[] = [];
    const duplicates: { item: FeedItem; of: string }[] = [];
    for (const item of candidates) {
      const tokens = titleTokens(item.title);
      // Dataset releases are keyed by their release folder, and their titles differ only by date.
      const match = item.sourceType === "dataset" ? undefined : known.find((k) => isNearDuplicate(tokens, k.tokens));
      if (match) {
        duplicates.push({ item, of: match.title });
      } else if (fresh.length < MAX_NEW_ITEMS_PER_RUN) {
        fresh.push(item);
        known.push({ title: item.title, tokens });
      }
    }

    let accepted = 0;
    let rejected = 0;
    let failed = 0;
    const newSignals: RefreshSummary["newSignals"] = [];

    for (const { item, of } of duplicates) {
      rejected++;
      const reason = `near-duplicate of "${of}"`.slice(0, 500);
      await db
        .insert(feedItems)
        .values({ externalId: item.externalId, feedKey: item.feedKey, title: item.title, url: item.url, publishedDate: item.publishedDate, runId: run.id, status: "rejected", reason })
        .onConflictDoUpdate({ target: feedItems.externalId, set: { status: "rejected", reason, runId: run.id, seenAt: new Date() } });
    }

    const catalog = await loadCatalog(db);
    const outcomes = fresh.length ? await tagger.tag(fresh, catalog) : [];

    for (let i = 0; i < fresh.length; i++) {
      const item = fresh[i];
      const outcome = outcomes[i] ?? { ok: false as const, error: "no tagger result" };
      const base = {
        externalId: item.externalId,
        feedKey: item.feedKey,
        title: item.title,
        url: item.url,
        publishedDate: item.publishedDate,
        runId: run.id,
        seenAt: new Date(),
      };

      if (!outcome.ok) {
        failed++;
        await db
          .insert(feedItems)
          .values({ ...base, status: "failed", reason: outcome.error.slice(0, 500) })
          .onConflictDoUpdate({ target: feedItems.externalId, set: { status: "failed", reason: outcome.error.slice(0, 500), runId: run.id, seenAt: base.seenAt } });
        continue;
      }

      const guarded = applyGuardrails(item, outcome.proposal, catalog);
      if (!guarded.accepted) {
        rejected++;
        await db
          .insert(feedItems)
          .values({ ...base, status: "rejected", reason: guarded.reason })
          .onConflictDoUpdate({ target: feedItems.externalId, set: { status: "rejected", reason: guarded.reason, runId: run.id, seenAt: base.seenAt } });
        continue;
      }

      const p = guarded.proposal;
      const [signal] = await db
        .insert(signals)
        .values({
          externalId: item.externalId,
          title: item.title,
          sourceName: item.sourceName,
          sourceType: item.sourceType,
          url: item.url,
          publishedDate: item.publishedDate,
          summary: p.summary,
          direction: p.direction,
          strength: p.strength,
          roleIds: p.roleIds,
          skillIds: p.skillIds,
          taggedBy: tagger.name,
          feedKey: item.feedKey,
        })
        .returning({ id: signals.id });
      accepted++;
      newSignals.push({ id: signal.id, title: item.title, direction: p.direction });
      const reason = [outcome.proposal.reason, ...guarded.notes].filter(Boolean).join("; ").slice(0, 500);
      await db
        .insert(feedItems)
        .values({ ...base, status: "accepted", reason, signalId: signal.id })
        .onConflictDoUpdate({ target: feedItems.externalId, set: { status: "accepted", reason, signalId: signal.id, runId: run.id, seenAt: base.seenAt } });
    }

    const anyFeedOk = feedResults.some((f) => f.ok);
    const status: RefreshSummary["status"] = !anyFeedOk ? "failed" : feedResults.every((f) => f.ok) && failed === 0 ? "ok" : "partial";

    await db
      .update(signalRefreshRuns)
      .set({ finishedAt: new Date(), status, feeds: feedResults, checked: fresh.length + duplicates.length, accepted, rejected, failed })
      .where(eq(signalRefreshRuns.id, run.id));


    return { runId: run.id, status, tagger: tagger.name, model: tagger.model, feeds: feedResults, checked: fresh.length + duplicates.length, accepted, rejected, failed, newSignals };
  } catch (err) {
    await db
      .update(signalRefreshRuns)
      .set({ finishedAt: new Date(), status: "failed", error: err instanceof Error ? err.message.slice(0, 500) : String(err) })
      .where(eq(signalRefreshRuns.id, run.id));
    throw err;
  }
}

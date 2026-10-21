// Re-checks signals that the keyword fallback tagged in earlier refreshes against the current
// keyword rules: items that would now be skipped are removed (and their feed item marked rejected,
// so a refresh won't re-add them); the rest get their direction and catalog links updated.
// Curated and Claude-tagged signals are never touched. Rankings are re-snapshotted afterwards.
// Usage: npm run signals:retag            (add --dry-run to only print what would change)
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const { eq } = await import("drizzle-orm");
  const { getDb } = await import("../lib/db");
  const { feedItems, roles, signals, skills } = await import("../lib/db/schema");
  const { snapshotProfiles } = await import("../lib/scoring/snapshots");
  const { applyGuardrails } = await import("../lib/signals/guardrails");
  const { CAUSE_ROLES, CAUSE_SKILLS, KeywordTagger, skipReason } = await import("../lib/signals/tag-keyword");

  const db = getDb();
  const [roleRows, skillRows, rows] = await Promise.all([
    db.select({ id: roles.id, slug: roles.slug, title: roles.title, sector: roles.sector, outlook: roles.outlook }).from(roles),
    db.select({ id: skills.id, slug: skills.slug, name: skills.name, category: skills.category }).from(skills),
    db.select().from(signals).where(eq(signals.taggedBy, "keyword")),
  ]);
  const catalog = { roles: roleRows, skills: skillRows };
  const roleSlug = new Map(roleRows.map((r) => [r.id, r.slug]));
  const skillSlug = new Map(skillRows.map((s) => [s.id, s.slug]));
  const items = rows.map((s) => ({
    externalId: String(s.id),
    feedKey: "retag",
    title: s.title,
    url: s.url,
    sourceName: s.sourceName,
    sourceType: s.sourceType as "news" | "research" | "dataset",
    publishedDate: s.publishedDate,
    snippet: s.summary === s.title ? "" : s.summary,
  }));
  const outcomes = await new KeywordTagger().tag(items, catalog);

  const sameIds = (a: number[], b: number[]) => a.length === b.length && [...a].sort().join() === [...b].sort().join();
  let removed = 0;
  let updated = 0;
  if (!dryRun) await snapshotProfiles(db); // "before" baseline so /results can show what changed
  for (const [i, s] of rows.entries()) {
    const out = outcomes[i];
    if (!out.ok) continue;
    // The original snippet isn't stored, so links found from it at ingest are kept (plus any the
    // title gives now); AI/automation links are dropped from declining items, where they're the cause.
    // An item is removed only if the new rules skip it or leave it with no catalog links.
    const skip = skipReason(s.title, items[i].snippet);
    // Decline words may have been in the snippet, so a stored "declining" is never flipped back.
    const declining = s.direction === "declining" || out.proposal.direction === "declining";
    const roleIds = [...new Set([...s.roleIds, ...out.proposal.roleIds])].filter((id) => !(declining && CAUSE_ROLES.has(roleSlug.get(id) ?? "")));
    const skillIds = [...new Set([...s.skillIds, ...out.proposal.skillIds])].filter((id) => !(declining && CAUSE_SKILLS.has(skillSlug.get(id) ?? "")));
    const links = roleIds.length + skillIds.length;
    const reason = skip ?? (links === 0 ? "only AI/automation links, which are the cause of a decline" : "kept");
    const proposal = { ...out.proposal, direction: declining ? ("declining" as const) : ("emerging" as const), roleIds, skillIds, relevant: !skip && links > 0, reason };
    const guarded = applyGuardrails(items[i], proposal, catalog);
    if (!guarded.accepted) {
      removed++;
      console.log(`remove  #${s.id} ${s.title}\n        (${guarded.reason})`);
      if (!dryRun) {
        await db.update(feedItems).set({ status: "rejected", reason: `retag: ${guarded.reason}`, signalId: null }).where(eq(feedItems.signalId, s.id));
        await db.delete(signals).where(eq(signals.id, s.id));
      }
      continue;
    }
    const p = guarded.proposal;
    if (p.direction !== s.direction || !sameIds(p.roleIds, s.roleIds) || !sameIds(p.skillIds, s.skillIds)) {
      updated++;
      console.log(`update  #${s.id} ${s.title} (${s.direction} → ${p.direction})`);
      if (!dryRun) await db.update(signals).set({ direction: p.direction, roleIds: p.roleIds, skillIds: p.skillIds }).where(eq(signals.id, s.id));
    }
  }
  const snaps = !dryRun && removed + updated > 0 ? await snapshotProfiles(db) : null;
  console.log(`\nChecked ${rows.length} keyword-tagged signals: ${removed} removed, ${updated} updated${dryRun ? " (dry run, nothing saved)" : ""}.`);
  if (snaps) console.log(`Rankings re-snapshotted for ${snaps.profiles} profiles.`);
  await db.$client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

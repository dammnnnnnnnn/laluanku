// Dry run of "Refresh signals" against an in-memory Postgres (PGlite): migrates, seeds,
// pulls the live feeds and tags them, then prints what would be added. Nothing is written
// to your real database. Uses Claude when credentials are set, else the keyword fallback.
// Usage: npm run signals:check
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const schema = await import("../lib/db/schema");
  const { runSeed } = await import("../lib/db/seed");
  const { runRefreshPipeline } = await import("../lib/refresh-pipeline");
  const { loadResults } = await import("../lib/scoring/results");
  const { headlineChange } = await import("../lib/scoring/diff");

  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  await runSeed(db);

  await loadResults(db, "siti-admin-returner"); // baseline snapshot, as a first visit would make
  const first = await runRefreshPipeline(db);
  console.log(`tagger: ${first.tagger}${first.model ? ` (${first.model})` : ""}  status: ${first.status}`);
  for (const f of first.feeds) console.log(`  ${f.ok ? "ok  " : "FAIL"} ${f.key}: ${f.ok ? `${f.items} items` : f.error}`);
  console.log(`checked ${first.checked}, accepted ${first.accepted}, rejected ${first.rejected}, failed ${first.failed}`);
  for (const s of first.newSignals) console.log(`  + [${s.direction}] ${s.title}`);

  const items = await db.select().from(schema.feedItems);
  const rejected = items.filter((i) => i.status !== "accepted").slice(0, 10);
  if (rejected.length) console.log("\nSample of items not accepted:");
  for (const r of rejected) console.log(`  - (${r.status}) ${r.title} :: ${r.reason}`);

  const after = await loadResults(db, "siti-admin-returner");
  if (after) {
    const title = new Map(after.roles.map((r) => [r.id, r.title]));
    for (const sc of after.scenarios) {
      const diff = after.changes[sc.key];
      const head = diff && headlineChange(diff);
      console.log(`
Siti, ${sc.name}: ${diff ? `${diff.newSignalIds.length} new signals` : "no earlier snapshot"}`);
      for (const c of diff?.changes ?? []) console.log(`  #${c.prevRank ?? "-"} -> #${c.currRank ?? "-"}  ${title.get(c.roleId)}${head?.roleId === c.roleId ? "  <- headline" : ""}`);
    }
  }

  const second = await runRefreshPipeline(db);
  console.log(`\nSecond run checked ${second.checked} new item(s): leftovers over the per-run cap, new feed items, or earlier failures.`);
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Prints the role ranking for each sample profile under each scenario, using an in-memory
// Postgres seeded from ./seed. Usage: npm run results:check
async function main() {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const schema = await import("../lib/db/schema");
  const { runSeed } = await import("../lib/db/seed");
  const { loadResults } = await import("../lib/scoring/results");
  const { finalScore } = await import("../lib/scoring/engine");

  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  await runSeed(db);

  const pct = (x: number) => `${Math.round(x * 100)}`.padStart(3);
  for (const key of ["siti-admin-returner", "aiman-fresh-grad", "daniel-factory-technician"]) {
    const data = await loadResults(db, key);
    if (!data) throw new Error(`profile ${key} not found`);
    console.log(`\n=== ${data.profile.displayName}: ${data.profile.headline}`);
    for (const sc of data.scenarios) {
      const ranked = data.roles
        .map((r) => ({ r, d: r.demand[sc.key], score: finalScore({ skill: r.skill.score, demand: r.demand[sc.key].normalized, interest: null }, data.defaultWeights) }))
        .sort((a, b) => b.score - a.score);
      console.log(`  -- ${sc.name}`);
      console.log("     final skill demand conf   role");
      for (const { r, d, score } of ranked.slice(0, 6)) {
        console.log(`     ${pct(score)}   ${pct(r.skill.score)}   ${pct(d.normalized)}   ${d.confidence.padEnd(6)} ${r.title}${r.outlook === "declining" ? " (declining)" : ""}`);
      }
    }
  }
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// Syncs skill embeddings from the RunPod endpoint into the database and prints what the
// similarity threshold would let count as "related", so the threshold can be tuned.
// Needs DATABASE_URL, RUNPOD_ENDPOINT and RUNPOD_API_KEY. Usage: npm run embeddings:check
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const { getDb } = await import("../lib/db");
  const { skills } = await import("../lib/db/schema");
  const { runpodConfig, cosine } = await import("../lib/runpod");
  const { syncSkillEmbeddings, embeddingThreshold } = await import("../lib/embeddings");

  const rp = runpodConfig();
  if (!rp) throw new Error("Set RUNPOD_ENDPOINT and RUNPOD_API_KEY first (see docs/runpod.md).");
  const db = getDb();
  const rows = await db.select({ id: skills.id, name: skills.name }).from(skills);

  const started = Date.now();
  const { vectors, embedded } = await syncSkillEmbeddings(db, rows, rp);
  console.log(`Model ${rp.model}: ${rows.length} skills, ${embedded} newly embedded in ${((Date.now() - started) / 1000).toFixed(1)} s, dimension ${vectors.values().next().value?.length}.`);

  const threshold = embeddingThreshold();
  const pairs: { a: string; b: string; sim: number }[] = [];
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      pairs.push({ a: rows[i].name, b: rows[j].name, sim: cosine(vectors.get(rows[i].id)!, vectors.get(rows[j].id)!) });
    }
  }
  pairs.sort((x, y) => y.sim - x.sim);
  const sims = pairs.map((p) => p.sim).sort((x, y) => x - y);
  const q = (p: number) => sims[Math.floor(p * (sims.length - 1))].toFixed(3);
  console.log(`Pairwise similarity: median ${q(0.5)}, p90 ${q(0.9)}, p99 ${q(0.99)}, max ${q(1)}.`);
  console.log(`Threshold ${threshold}: ${pairs.filter((p) => p.sim >= threshold).length} of ${pairs.length} skill pairs would count as related.\n`);
  console.log("Closest pairs:");
  for (const p of pairs.slice(0, 25)) console.log(`  ${p.sim.toFixed(3)} ${p.sim >= threshold ? "✓" : " "} ${p.a}  ↔  ${p.b}`);
  await db.$client.end();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

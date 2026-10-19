import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  // Imported after dotenv so DATABASE_URL is set.
  const { getDb } = await import("../lib/db");
  const { runSeed } = await import("../lib/db/seed");
  const db = getDb();
  const counts = await runSeed(db);
  console.log("Seeded:", counts);
  await db.$client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

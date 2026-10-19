// Runs the same refresh as the admin button, from the command line (useful for a cron job).
// Usage: npm run signals:refresh
import { config } from "dotenv";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const { getDb } = await import("../lib/db");
  const { refreshSignals } = await import("../lib/signals/refresh");
  const db = getDb();
  const summary = await refreshSignals(db);
  console.log(JSON.stringify(summary, null, 2));
  await db.$client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

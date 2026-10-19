// Applies the SQL migrations in ./drizzle using only production dependencies (no drizzle-kit),
// so it can run at deploy start. Usage: node scripts/migrate.mjs
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. On Replit, create the Postgres database first (it sets DATABASE_URL).");
  process.exit(1);
}

const client = postgres(url, { max: 1, onnotice: () => {} });
try {
  await migrate(drizzle(client), { migrationsFolder: "drizzle" });
  console.log("Migrations applied.");
} catch (err) {
  console.error("Migration failed:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await client.end();
}

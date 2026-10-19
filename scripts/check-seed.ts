// Validates seed files, then runs migrations + seed twice against an in-memory Postgres
// (PGlite), so anyone can check seed edits without a database. Usage: npm run db:check
import { PGlite } from "@electric-sql/pglite";
import { count, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "../lib/db/schema";
import { runSeed } from "../lib/db/seed";

async function main() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });

  const first = await runSeed(db);
  await runSeed(db); // must be idempotent

  const tables = { skills: schema.skills, roles: schema.roles, role_skills: schema.roleSkills, signals: schema.signals, scenarios: schema.scenarios, profiles: schema.profiles, courses: schema.courses };
  for (const [name, table] of Object.entries(tables)) {
    const [{ n }] = await db.select({ n: count() }).from(table);
    console.log(`${name.padEnd(12)} ${n}`);
  }

  const expected = { skills: first.skills, roles: first.roles, role_skills: first.roleSkills, signals: first.signals, courses: first.courses };
  for (const [name, n] of Object.entries(expected)) {
    const [{ c }] = await db.execute<{ c: number }>(sql.raw(`select count(*)::int as c from ${name}`)).then((r) => r.rows);
    if (c !== n) throw new Error(`${name}: expected ${n} rows after re-seed, found ${c}`);
  }

  const orphanSignals = await db.execute(
    sql`select external_id from signals where cardinality(role_ids) = 0 and cardinality(skill_ids) = 0`,
  );
  if (orphanSignals.rows.length) throw new Error(`Signals with no roles or skills: ${JSON.stringify(orphanSignals.rows)}`);

  console.log("Seed check passed.");
  await client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

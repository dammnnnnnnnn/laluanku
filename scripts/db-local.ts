// Local development database with no Postgres install: PGlite (Postgres compiled to WASM),
// stored in ./.pglite and served over the Postgres wire protocol on 127.0.0.1:54329.
// Applies migrations and the seed on every start (both idempotent), and creates .env.local
// pointing at it if you don't have one. Usage: npm run db:local  (leave it running)
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const PORT = Number(process.env.PGLITE_PORT) || 54329;
const DIR = process.env.PGLITE_DIR || "./.pglite";
const URL = `postgres://postgres:postgres@127.0.0.1:${PORT}/postgres`;

function ensureEnvFile() {
  const file = ".env.local";
  if (!existsSync(file)) {
    const token = randomBytes(18).toString("hex");
    writeFileSync(
      file,
      [
        "# Created by npm run db:local. Never commit this file.",
        `DATABASE_URL=${URL}`,
        "# The local PGlite server handles one connection reliably.",
        "DATABASE_POOL_MAX=1",
        `ADMIN_TOKEN=${token}`,
        "",
      ].join("\n"),
    );
    console.log(`Created ${file} (DATABASE_URL, DATABASE_POOL_MAX=1 and a random ADMIN_TOKEN).`);
    return;
  }
  const env = readFileSync(file, "utf8");
  if (!env.includes(URL) || !/^DATABASE_POOL_MAX=1\s*$/m.test(env)) {
    console.log(`\n${file} exists but doesn't point at the local database. Make sure it contains:\n  DATABASE_URL=${URL}\n  DATABASE_POOL_MAX=1\n`);
  }
}

async function main() {
  const { PGlite } = await import("@electric-sql/pglite");
  const { PGLiteSocketServer } = await import("@electric-sql/pglite-socket");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const schema = await import("../lib/db/schema");
  const { runSeed } = await import("../lib/db/seed");

  const pg = new PGlite(DIR);
  const db = drizzle(pg, { schema });
  await migrate(db, { migrationsFolder: "drizzle" });
  const counts = await runSeed(db);
  console.log(`Database at ${DIR}: migrations applied, seed loaded (${counts.roles} roles, ${counts.skills} skills, ${counts.signals} curated signals).`);

  const server = new PGLiteSocketServer({ db: pg, host: "127.0.0.1", port: PORT, maxConnections: 8 });
  await server.start();
  ensureEnvFile();
  console.log(`\nLocal Postgres is running at ${URL}`);
  console.log("In another terminal run: npm run dev");
  console.log("Press Ctrl+C to stop. Data is kept in .pglite/ between runs.\n");

  const stop = async () => {
    await server.stop();
    await pg.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema> & { $client: postgres.Sql };

// Reuse one connection pool across hot reloads in dev.
const globalForDb = globalThis as unknown as { laluankuDb?: Db };

// Lazy so that `next build` works without DATABASE_URL.
export function getDb(): Db {
  if (globalForDb.laluankuDb) return globalForDb.laluankuDb;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const db = drizzle(postgres(url, { max: 5 }), { schema });
  globalForDb.laluankuDb = db;
  return db;
}

export { schema };

import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

// Any Drizzle Postgres database with our schema: postgres.js in the app, PGlite in checks.
export type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;

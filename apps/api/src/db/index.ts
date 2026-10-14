import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

/** Any Drizzle Postgres database with our schema: postgres.js in production, PGlite in tests. */
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

let db: Db | undefined;

export function getDb(): Db {
  if (db) return db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  // prepare: false — Neon's pooled endpoint (PgBouncer, transaction mode)
  // does not support named prepared statements.
  db = drizzle(postgres(url, { prepare: false, max: 5 }), { schema, casing: "snake_case" }) as unknown as Db;
  return db;
}

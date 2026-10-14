import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/pglite";
import type { Db } from "../db/index.js";
import * as schema from "../db/schema.js";

/** A fresh in-process Postgres (PGlite) with every migration applied: real constraints, no server. */
export async function createTestDb(): Promise<Db> {
  const client = new PGlite();
  const dir = path.join(import.meta.dirname, "../../drizzle");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    for (const statement of readFileSync(path.join(dir, file), "utf8").split("--> statement-breakpoint")) {
      if (statement.trim()) await client.exec(statement);
    }
  }
  return drizzle(client, { schema, casing: "snake_case" }) as unknown as Db;
}

export const resetTestDb = (db: Db) => db.execute(sql`TRUNCATE forms, rate_limits CASCADE`);

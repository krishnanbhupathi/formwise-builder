import { config } from "dotenv";
config({ path: ["../../.env.local", "../../.env"], quiet: true });

import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  // Preview deployments have no database yet (they'd otherwise migrate production).
  if (process.env.VERCEL_ENV === "preview") {
    console.log("No DATABASE_URL in this preview deployment; skipping migrations");
    process.exit(0);
  }
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
try {
  await migrate(drizzle(client), { migrationsFolder: path.join(import.meta.dirname, "../drizzle") });
  console.log("Migrations applied");
} finally {
  await client.end();
}

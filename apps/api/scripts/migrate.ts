import { config } from "dotenv";
config({ path: ["../../.env.local", "../../.env"], quiet: true });

import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
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

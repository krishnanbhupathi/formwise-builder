import { sql } from "drizzle-orm";
import type { Db } from "../db/index.js";
import { rateLimits } from "../db/schema.js";

/**
 * Fixed-window counter in Postgres (one upsert per hit). Returns true if the
 * request is allowed. Good enough to stop a script spamming a public form;
 * not a replacement for an edge rate limiter.
 */
export async function allow(db: Db, key: string, limit: number, windowMs: number, now: Date): Promise<boolean> {
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const [row] = await db
    .insert(rateLimits)
    .values({ key, windowStart, count: 1 })
    .onConflictDoUpdate({ target: [rateLimits.key, rateLimits.windowStart], set: { count: sql`${rateLimits.count} + 1` } })
    .returning({ count: rateLimits.count });
  return (row?.count ?? 0) <= limit;
}

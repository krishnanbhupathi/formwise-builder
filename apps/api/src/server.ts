import { config } from "dotenv";
config({ path: ["../../.env.local", "../../.env"], quiet: true });

import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { getDb } from "./db/index.js";

// Local development server; on Vercel, api/[[...route]].ts serves the same app.
const port = Number(process.env.API_PORT ?? 8787);
serve({ fetch: createApp({ db: getDb() }).fetch, port }, () => console.log(`Formwise API on http://localhost:${port}/api`));

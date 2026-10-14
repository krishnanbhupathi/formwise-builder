import { config } from "dotenv";
config({ path: ["../../.env.local", "../../.env"], quiet: true });

import { serve } from "@hono/node-server";
import { anthropicModel } from "./ai/anthropic.js";
import { fakeModel } from "./ai/fake.js";
import { generateForm } from "./ai/generate.js";
import { createApp } from "./app.js";
import { getDb } from "./db/index.js";

// Local development server; on Vercel, api/[[...route]].ts serves the same app.
const port = Number(process.env.API_PORT ?? 8787);
// FORMWISE_FAKE_AI=1 (local e2e) swaps in a deterministic model so tests never spend credits.
const model = process.env.FORMWISE_FAKE_AI === "1" ? fakeModel : process.env.ANTHROPIC_API_KEY ? anthropicModel(process.env.ANTHROPIC_API_KEY) : undefined;
const generate = model && ((description: string, formId: string) => generateForm(description, model, formId));
serve({ fetch: createApp({ db: getDb(), generate }).fetch, port }, () => console.log(`Formwise API on http://localhost:${port}/api`));

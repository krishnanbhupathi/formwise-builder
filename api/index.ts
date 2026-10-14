// Vercel entry. vercel.json rewrites every /api/* path here; Hono routes on
// the original URL. Node runtime, since postgres.js needs TCP sockets.
import { handle } from "hono/vercel";
import { anthropicModel } from "../apps/api/src/ai/anthropic.js";
import { generateForm } from "../apps/api/src/ai/generate.js";
import { createApp } from "../apps/api/src/app.js";
import { getDb } from "../apps/api/src/db/index.js";

const key = process.env.ANTHROPIC_API_KEY;
const model = key ? anthropicModel(key) : undefined;

const handler = handle(
  createApp({
    db: getDb(),
    generate: model && ((description, formId) => generateForm(description, model, formId)),
  }),
);

export const GET = handler;
export const POST = handler;
export const PUT = handler;

// Vercel entry. vercel.json rewrites every /api/* path here; Hono routes on
// the original URL. Node runtime, since postgres.js needs TCP sockets.
import { handle } from "hono/vercel";
import { createApp } from "../apps/api/src/app.js";
import { getDb } from "../apps/api/src/db/index.js";

const handler = handle(createApp({ db: getDb() }));

export const GET = handler;
export const POST = handler;
export const PUT = handler;

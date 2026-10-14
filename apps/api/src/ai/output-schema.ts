import { z } from "zod";
import { draftFormSchema } from "./draft.js";

/**
 * Structured outputs accept a subset of JSON Schema, so the schema sent to the
 * model drops length/range limits. Those limits aren't lost: every answer is
 * still parsed with the full Zod schema (and `parseFormSchema`), and a
 * violation goes back to the model as a retry.
 */
const UNSUPPORTED = new Set(["maxItems", "minItems", "maxLength", "minLength", "pattern", "minimum", "maximum", "exclusiveMinimum", "exclusiveMaximum", "multipleOf", "$schema"]);

function strip(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strip);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) if (!UNSUPPORTED.has(k)) out[k] = strip(v);
  if (out.type === "object") out.additionalProperties = false;
  return out;
}

export const draftOutputSchema = strip(z.toJSONSchema(draftFormSchema, { target: "draft-7" })) as Record<string, unknown>;

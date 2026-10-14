import { isInputField, parseFormSchema, type FormSchema } from "@formwise/renderer/core";
import { draftFormSchema, draftToForm } from "./draft.js";

/** One model turn: the parsed JSON it produced (undefined if it wasn't JSON) plus its raw text, to continue the conversation. */
export type ModelTurn = { output: unknown; text: string; inputTokens: number; outputTokens: number };

/** A conversation so far: the description, then (on retry) the previous attempt and its errors. */
export type Exchange = { description: string; retry?: { previous: ModelTurn; errors: string[] } };

/** Calls the model. Injected so tests (and local e2e) never call the real API. */
export type CallModel = (exchange: Exchange) => Promise<ModelTurn>;

export type GenerateResult =
  | { ok: true; form: FormSchema; attempts: number; inputTokens: number; outputTokens: number }
  | { ok: false; error: string; attempts: number; inputTokens: number; outputTokens: number };

export const MAX_ATTEMPTS = 2;

/** Checks a draft end to end; returns the form or the list of problems to send back. */
function check(output: unknown, formId: string): { form: FormSchema } | { errors: string[] } {
  const draft = draftFormSchema.safeParse(output);
  if (!draft.success) return { errors: draft.error.issues.map((i) => `${i.path.join(".") || "form"}: ${i.message}`) };
  const parsed = parseFormSchema(draftToForm(draft.data, formId));
  if (!parsed.ok) return { errors: parsed.errors };
  if (!parsed.form.fields.some(isInputField)) return { errors: ["fields: the form needs at least one question (not only headings)"] };
  return { form: parsed.form };
}

/** Generates a form, retrying once with the validation errors if the first answer doesn't pass. */
export async function generateForm(description: string, callModel: CallModel, formId: string): Promise<GenerateResult> {
  let exchange: Exchange = { description };
  let inputTokens = 0;
  let outputTokens = 0;
  let lastErrors: string[] = [];
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const turn = await callModel(exchange);
    inputTokens += turn.inputTokens;
    outputTokens += turn.outputTokens;
    const result = check(turn.output, formId);
    if ("form" in result) return { ok: true, form: result.form, attempts: attempt, inputTokens, outputTokens };
    lastErrors = result.errors;
    exchange = { description, retry: { previous: turn, errors: result.errors } };
  }
  console.warn(JSON.stringify({ event: "ai_generate_invalid", errors: lastErrors.slice(0, 5) }));
  return { ok: false, error: "Couldn't build a valid form from that description. Try rephrasing it.", attempts: MAX_ATTEMPTS, inputTokens, outputTokens };
}

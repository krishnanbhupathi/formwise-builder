import { FIELD_TYPES, SCHEMA_VERSION, type Field, type FormSchema } from "@formwise/renderer/core";
import { z } from "zod";

/**
 * What the model fills in. Deliberately simpler than FormSchema: fields have
 * readable keys, conditions point at keys, and dropdown options are plain
 * text. `draftToForm` turns it into a real schema with ids, so the model never
 * has to invent or cross-reference internal ids.
 */
const key = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);

export const draftFieldSchema = z.object({
  key: key.describe("Short unique snake_case key, e.g. full_name"),
  type: z.enum(FIELD_TYPES).describe("heading = a section title that collects nothing"),
  label: z.string().min(1).max(200).describe("The question as the person filling in the form sees it"),
  required: z.boolean(),
  helpText: z.string().max(300).optional().describe("One short line of guidance, only if useful"),
  placeholder: z.string().max(100).optional().describe("text, textarea, email and number only"),
  options: z.array(z.string().min(1).max(100)).min(1).max(30).optional().describe("select only: the choices, in display order"),
  min: z.number().optional().describe("number only"),
  max: z.number().optional().describe("number only"),
  integer: z.boolean().optional().describe("number only: whole numbers"),
  maxLength: z.number().int().min(1).max(5000).optional().describe("text and textarea only"),
  accept: z.string().max(100).optional().describe('file only, e.g. ".pdf,image/*"'),
  maxSizeMb: z.number().positive().max(25).optional().describe("file only"),
  showIf: z
    .object({
      key: key.describe("Key of an EARLIER select, checkbox or text field"),
      equals: z.union([z.string(), z.boolean()]).describe("select: one of its option texts; checkbox: true or false; text: the exact answer"),
    })
    .optional()
    .describe("Only show this question when an earlier answer matches"),
});

export const draftFormSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional().describe("One or two sentences shown under the title"),
  fields: z.array(draftFieldSchema).min(1).max(40),
});

export type DraftForm = z.infer<typeof draftFormSchema>;
type DraftField = DraftForm["fields"][number];

const TEXTUAL = new Set(["text", "textarea", "email", "number"]);

function convertField(d: DraftField, id: string): Field {
  const base = { id, label: d.label, required: d.type === "heading" ? false : d.required, ...(d.helpText ? { helpText: d.helpText } : {}) };
  const placeholder = d.placeholder && TEXTUAL.has(d.type) ? { placeholder: d.placeholder } : {};
  switch (d.type) {
    case "text":
    case "textarea":
      return { ...base, type: d.type, ...placeholder, ...(d.maxLength ? { maxLength: d.maxLength } : {}) };
    case "number":
      return {
        ...base,
        type: "number",
        ...placeholder,
        ...(d.min !== undefined ? { min: d.min } : {}),
        ...(d.max !== undefined ? { max: d.max } : {}),
        ...(d.integer ? { integer: true } : {}),
      };
    case "email":
      return { ...base, type: "email", ...placeholder };
    case "select":
      return { ...base, type: "select", options: (d.options ?? []).map((label, i) => ({ id: `${id}_o${i + 1}`, label })) };
    case "file":
      return { ...base, type: "file", ...(d.accept ? { accept: d.accept } : {}), ...(d.maxSizeMb ? { maxSizeMb: d.maxSizeMb } : {}) };
    default:
      return { ...base, type: d.type };
  }
}

/**
 * Builds a FormSchema from a draft. Problems the model can fix (a condition
 * on a missing key, an unknown option) are left in place on purpose, so
 * `parseFormSchema` reports them and the model gets a precise retry message.
 */
export function draftToForm(draft: DraftForm, formId: string): FormSchema {
  const ids = new Map<string, string>();
  const fields = draft.fields.map((d) => {
    let id = `f_${d.key}`;
    for (let n = 2; [...ids.values()].includes(id); n++) id = `f_${d.key}_${n}`;
    if (!ids.has(d.key)) ids.set(d.key, id);
    return { draft: d, field: convertField(d, id) };
  });
  const byId = new Map(fields.map(({ field }) => [field.id, field]));

  for (const { draft: d, field } of fields) {
    if (!d.showIf) continue;
    const targetId = ids.get(d.showIf.key) ?? `f_${d.showIf.key}`;
    const target = byId.get(targetId);
    let equals = d.showIf.equals;
    if (target?.type === "select") {
      const wanted = String(equals).trim().toLowerCase();
      equals = target.options.find((o) => o.label.trim().toLowerCase() === wanted)?.id ?? String(equals);
    } else if (target?.type === "checkbox" && typeof equals === "string") {
      equals = equals.trim().toLowerCase() === "true";
    } else if (target?.type === "text") {
      equals = String(equals);
    }
    field.showIf = { fieldId: targetId, equals };
  }

  return {
    version: SCHEMA_VERSION,
    id: formId,
    title: draft.title,
    ...(draft.description ? { description: draft.description } : {}),
    fields: fields.map(({ field }) => field),
  };
}

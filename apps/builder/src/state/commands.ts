import { canBeCondition, SCHEMA_VERSION, type Field, type FieldType, type FormSchema } from "@formwise/renderer";
import { current, produce } from "immer";
import { nanoid } from "nanoid";

/**
 * Every change to a form is a plain command applied by a pure function.
 * The store only ever calls `applyCommand`, which keeps changes testable and
 * gives undo/redo (Day 5) a single place to record history.
 */
export type Command =
  | { type: "addField"; fieldType: FieldType; index?: number; id?: string }
  | { type: "moveField"; id: string; toIndex: number }
  | { type: "removeField"; id: string }
  | { type: "duplicateField"; id: string; newId?: string }
  | { type: "updateField"; id: string; patch: FieldPatch }
  | { type: "updateForm"; patch: { title?: string; description?: string } }
  | { type: "replaceForm"; form: FormSchema };

/** Any field property except identity and type. */
export type FieldPatch = { [K in AllFieldKeys]?: unknown };
type AllFieldKeys = Exclude<Field extends infer F ? (F extends Field ? keyof F : never) : never, "id" | "type">;

export type CommandResult = {
  form: FormSchema;
  /** Fields whose condition was removed because the change made it invalid. */
  clearedConditions: string[];
};

export const newFieldId = () => `f_${nanoid(8)}`;
export const newOptionId = () => `o_${nanoid(6)}`;

export const FIELD_LABELS: Record<FieldType, string> = {
  text: "Short answer",
  textarea: "Long answer",
  email: "Email",
  number: "Number",
  select: "Dropdown",
  checkbox: "Checkbox",
  date: "Date",
  file: "File upload",
  heading: "Section heading",
};

export function createField(type: FieldType, id = newFieldId()): Field {
  const base = { id, label: type === "heading" ? "New section" : "Untitled question", required: false };
  switch (type) {
    case "select":
      return { ...base, type, options: [{ id: newOptionId(), label: "Option 1" }, { id: newOptionId(), label: "Option 2" }] };
    case "checkbox":
      return { ...base, type, label: "I agree" };
    default:
      return { ...base, type } as Field;
  }
}

export function emptyForm(id = `form_${nanoid(10)}`): FormSchema {
  return { version: SCHEMA_VERSION, id, title: "Untitled form", fields: [] };
}

/**
 * Removes conditions that no longer hold: target missing, below the field,
 * not usable as a condition, or pointing at a deleted option. Mutates a draft.
 */
function clearBrokenConditions(fields: Field[]): string[] {
  const cleared: string[] = [];
  const index = new Map(fields.map((f, i) => [f.id, i]));
  fields.forEach((field, i) => {
    const rule = field.showIf;
    if (!rule) return;
    const targetIndex = index.get(rule.fieldId);
    const target = targetIndex === undefined ? undefined : fields[targetIndex];
    const ok =
      target !== undefined &&
      targetIndex! < i &&
      canBeCondition(target) &&
      (target.type !== "select" || target.options.some((o) => o.id === rule.equals)) &&
      (target.type !== "checkbox" || typeof rule.equals === "boolean") &&
      (target.type !== "text" || typeof rule.equals === "string");
    if (!ok) {
      delete field.showIf;
      cleared.push(field.id);
    }
  });
  return cleared;
}

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

export function applyCommand(form: FormSchema, command: Command): CommandResult {
  if (command.type === "replaceForm") return { form: command.form, clearedConditions: [] };

  let clearedConditions: string[] = [];
  const next = produce(form, (draft) => {
    const fields = draft.fields;
    const at = (id: string) => fields.findIndex((f) => f.id === id);

    switch (command.type) {
      case "addField": {
        const index = clamp(command.index ?? fields.length, 0, fields.length);
        fields.splice(index, 0, createField(command.fieldType, command.id));
        break;
      }
      case "moveField": {
        const from = at(command.id);
        const to = clamp(command.toIndex, 0, fields.length - 1);
        if (from === -1 || from === to) return;
        const [field] = fields.splice(from, 1);
        fields.splice(to, 0, field!);
        break;
      }
      case "removeField": {
        const i = at(command.id);
        if (i !== -1) fields.splice(i, 1);
        break;
      }
      case "duplicateField": {
        const i = at(command.id);
        if (i === -1) return;
        const copy = structuredClone(current(fields[i]!));
        copy.id = command.newId ?? newFieldId();
        if (copy.type === "select") copy.options = copy.options.map((o) => ({ ...o, id: newOptionId() }));
        fields.splice(i + 1, 0, copy);
        break;
      }
      case "updateField": {
        const field = fields[at(command.id)];
        if (!field) return;
        for (const [key, value] of Object.entries(command.patch)) {
          if (value === undefined || value === "") delete (field as Record<string, unknown>)[key];
          else (field as Record<string, unknown>)[key] = value;
        }
        break;
      }
      case "updateForm": {
        if (command.patch.title !== undefined) draft.title = command.patch.title;
        if (command.patch.description !== undefined) {
          if (command.patch.description) draft.description = command.patch.description;
          else delete draft.description;
        }
        break;
      }
    }
    clearedConditions = clearBrokenConditions(fields);
  });
  return { form: next, clearedConditions };
}

import type { Field, FieldType } from "@formwise/renderer";
import { FIELD_LABELS } from "../state/commands";

/** Each type has a three-letter code, printed in box corners like a form's field codes. */
export const PALETTE: { type: FieldType; code: string; hint: string }[] = [
  { type: "text", code: "TXT", hint: "One line of text" },
  { type: "textarea", code: "LNG", hint: "Several lines of text" },
  { type: "email", code: "EML", hint: "A validated email address" },
  { type: "number", code: "NUM", hint: "A number with optional limits" },
  { type: "select", code: "SEL", hint: "Pick one option" },
  { type: "checkbox", code: "CHK", hint: "Yes / no, e.g. consent" },
  { type: "date", code: "DAT", hint: "A calendar date" },
  { type: "file", code: "FIL", hint: "File details (type and size checked)" },
  { type: "heading", code: "HDG", hint: "A section title, collects nothing" },
];

export const codeFor = (type: FieldType) => PALETTE.find((p) => p.type === type)?.code ?? "???";
export const typeName = (type: FieldType) => FIELD_LABELS[type];
export const fieldName = (field: Field) => field.label.trim() || "Untitled question";

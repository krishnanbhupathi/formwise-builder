import type { Field, FieldType } from "@formwise/renderer";
import { FIELD_LABELS } from "../state/commands";

export const PALETTE: { type: FieldType; glyph: string; hint: string }[] = [
  { type: "text", glyph: "Aa", hint: "One line of text" },
  { type: "textarea", glyph: "¶", hint: "Several lines of text" },
  { type: "email", glyph: "@", hint: "A validated email address" },
  { type: "number", glyph: "#", hint: "A number with optional limits" },
  { type: "select", glyph: "▾", hint: "Pick one option" },
  { type: "checkbox", glyph: "☑", hint: "Yes / no, e.g. consent" },
  { type: "date", glyph: "📅", hint: "A calendar date" },
  { type: "file", glyph: "📎", hint: "File details (type and size checked)" },
  { type: "heading", glyph: "H", hint: "A section title, collects nothing" },
];

export const glyphFor = (type: FieldType) => PALETTE.find((p) => p.type === type)?.glyph ?? "?";
export const typeName = (type: FieldType) => FIELD_LABELS[type];
export const fieldName = (field: Field) => field.label.trim() || "Untitled question";

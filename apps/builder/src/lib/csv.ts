import { isInputField, type FieldValue, type FormSchema } from "@formwise/renderer";
import type { Submission } from "./api";

export type Column = { id: string; label: string };

/**
 * Columns for a submissions table: the newest version's questions in order,
 * then questions only older versions had (marked "removed"), so no answer is
 * ever hidden.
 */
export function submissionColumns(versions: Record<string, FormSchema>): Column[] {
  const ordered = Object.entries(versions)
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([, form]) => form);
  const columns: Column[] = [];
  const seen = new Set<string>();
  ordered.forEach((form, i) => {
    for (const f of form.fields.filter(isInputField)) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      const label = f.label || "Untitled question";
      columns.push({ id: f.id, label: i === 0 ? label : `${label} (removed)` });
    }
  });
  return columns;
}

export function formatValue(value: FieldValue | undefined): string {
  if (value === undefined || value === null) return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return `${value.name} (${Math.max(1, Math.round(value.size / 1024))} KB)`;
  return String(value);
}

/** One CSV cell: quoted when needed, and defused if a spreadsheet would run it as a formula. */
export function csvCell(text: string): string {
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function toCsv(columns: Column[], rows: Submission[]): string {
  const header = ["Submitted at (UTC)", "Form version", ...columns.map((c) => c.label)];
  const lines = rows.map((r) => [r.createdAt, String(r.version), ...columns.map((c) => formatValue(r.data[c.id]))]);
  // CRLF and a BOM so Excel opens UTF-8 correctly.
  return "﻿" + [header, ...lines].map((cells) => cells.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

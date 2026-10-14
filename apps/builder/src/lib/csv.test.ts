import type { FormSchema } from "@formwise/renderer";
import { describe, expect, it } from "vitest";
import { csvCell, formatValue, submissionColumns, toCsv } from "./csv";

const v1: FormSchema = {
  version: 1,
  id: "f",
  title: "T",
  fields: [
    { id: "name", type: "text", label: "Name", required: true },
    { id: "old", type: "text", label: "Old question", required: false },
  ],
};
const v2: FormSchema = {
  ...v1,
  fields: [
    { id: "h", type: "heading", label: "Section", required: false },
    { id: "email", type: "email", label: "Email", required: true },
    { id: "name", type: "text", label: "Full name", required: true },
  ],
};

describe("submissionColumns", () => {
  it("uses the newest version's order and labels, then keeps removed questions", () => {
    expect(submissionColumns({ "1": v1, "2": v2 })).toEqual([
      { id: "email", label: "Email" },
      { id: "name", label: "Full name" },
      { id: "old", label: "Old question (removed)" },
    ]);
  });

  it("orders versions numerically, not as strings", () => {
    const v10 = { ...v1, fields: [{ id: "x", type: "text" as const, label: "Ten", required: false }] };
    expect(submissionColumns({ "9": v1, "10": v10 })[0]).toEqual({ id: "x", label: "Ten" });
  });
});

describe("csv", () => {
  it("formats answers for people", () => {
    expect(formatValue(true)).toBe("Yes");
    expect(formatValue(false)).toBe("No");
    expect(formatValue(null)).toBe("");
    expect(formatValue({ name: "r.pdf", size: 2048, type: "application/pdf" })).toBe("r.pdf (2 KB)");
    expect(formatValue(42)).toBe("42");
  });

  it("quotes commas, quotes and newlines", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell("a, b")).toBe('"a, b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell("line\nbreak")).toBe('"line\nbreak"');
  });

  it("defuses spreadsheet formulas (CSV injection)", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe("\"'=HYPERLINK(\"\"http://evil\"\")\"");
    expect(csvCell("+1 555")).toBe("'+1 555");
    expect(csvCell("@sum")).toBe("'@sum");
    expect(csvCell("-2")).toBe("'-2");
  });

  it("builds a UTF-8 CSV with header, version and answers", () => {
    const csv = toCsv(submissionColumns({ "1": v1 }), [
      { id: "s1", version: 1, createdAt: "2026-10-20T10:00:00.000Z", data: { name: "Zoë, Jr" } },
    ]);
    expect(csv).toBe('﻿Submitted at (UTC),Form version,Name,Old question\r\n2026-10-20T10:00:00.000Z,1,"Zoë, Jr",\r\n');
  });
});

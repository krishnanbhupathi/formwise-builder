import { parseFormSchema } from "@formwise/renderer/core";
import { describe, expect, it } from "vitest";
import { draftToForm, type DraftForm } from "./draft.js";

const draft: DraftForm = {
  title: "Tutoring intake",
  fields: [
    { key: "about", type: "heading", label: "About you", required: true },
    { key: "name", type: "text", label: "Name", required: true, placeholder: "Sam", options: ["ignored"] },
    { key: "level", type: "select", label: "Level", required: true, options: ["GCSE", "A-level"] },
    { key: "board", type: "text", label: "Exam board", required: false, showIf: { key: "level", equals: "a-level " } },
    { key: "report", type: "checkbox", label: "I have a report", required: false },
    { key: "file", type: "file", label: "Report", required: true, accept: ".pdf", placeholder: "nope", showIf: { key: "report", equals: "true" } },
  ],
};

describe("draftToForm", () => {
  const form = draftToForm(draft, "form_1");

  it("produces a valid schema with readable ids", () => {
    expect(parseFormSchema(form)).toEqual({ ok: true, form });
    expect(form.fields.map((f) => f.id)).toEqual(["f_about", "f_name", "f_level", "f_board", "f_report", "f_file"]);
  });

  it("drops settings that don't belong to the field type", () => {
    expect(form.fields[0]).toEqual({ id: "f_about", type: "heading", label: "About you", required: false });
    expect(form.fields[1]).toEqual({ id: "f_name", type: "text", label: "Name", required: true, placeholder: "Sam" });
    expect(form.fields[5]).not.toHaveProperty("placeholder");
  });

  it("maps conditions to ids: select by option text (case-insensitive), checkbox to a boolean", () => {
    expect(form.fields[3]!.showIf).toEqual({ fieldId: "f_level", equals: "f_level_o2" });
    expect(form.fields[5]!.showIf).toEqual({ fieldId: "f_report", equals: true });
  });

  it("keeps duplicate keys apart", () => {
    const dup = draftToForm({ title: "T", fields: [
      { key: "q", type: "text", label: "A", required: false },
      { key: "q", type: "text", label: "B", required: false },
    ] }, "f");
    expect(dup.fields.map((f) => f.id)).toEqual(["f_q", "f_q_2"]);
  });

  it("leaves fixable mistakes for the schema check to report (so the model can retry)", () => {
    const bad = draftToForm({ title: "T", fields: [
      { key: "a", type: "text", label: "A", required: false, showIf: { key: "later", equals: "x" } },
      { key: "later", type: "select", label: "L", required: false, options: ["Yes"] },
      { key: "b", type: "text", label: "B", required: false, showIf: { key: "later", equals: "Maybe" } },
    ] }, "f");
    const result = parseFormSchema(bad);
    expect(!result.ok && result.errors).toEqual([
      "fields.0.showIf: Condition must refer to a field above this one",
      "fields.2.showIf: Condition refers to an option that doesn't exist",
    ]);
  });
});

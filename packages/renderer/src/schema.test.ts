import { describe, expect, it } from "vitest";
import { parseFormSchema, SCHEMA_VERSION, type FormSchema } from "./schema.js";
import { tutoringIntake } from "./test-forms.js";

const withFields = (fields: unknown[]) => ({ ...tutoringIntake, fields });
const errorsOf = (input: unknown) => {
  const result = parseFormSchema(input);
  return result.ok ? [] : result.errors;
};

describe("parseFormSchema", () => {
  it("accepts a valid form and fills defaults", () => {
    const result = parseFormSchema({
      version: 1,
      id: "f",
      title: "T",
      fields: [{ id: "a", type: "text", label: "A" }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.form.fields[0]).toMatchObject({ required: false });
  });

  it("round-trips through JSON (export → import)", () => {
    const result = parseFormSchema(JSON.parse(JSON.stringify(tutoringIntake)));
    expect(result).toEqual({ ok: true, form: tutoringIntake });
  });

  it.each([null, [], "form", 42])("rejects non-objects (%j)", (input) => {
    expect(errorsOf(input)).toEqual(["Not a form: expected a JSON object"]);
  });

  it("rejects a missing version and a version from the future", () => {
    expect(errorsOf({ ...tutoringIntake, version: undefined })).toEqual(['Missing or invalid "version"']);
    expect(errorsOf({ ...tutoringIntake, version: SCHEMA_VERSION + 1 })[0]).toMatch(/supports up to 1/);
  });

  it("rejects unknown field types with a path", () => {
    expect(errorsOf(withFields([{ id: "a", type: "signature", label: "Sign" }]))[0]).toMatch(/^fields\.0/);
  });

  it("rejects duplicate field ids", () => {
    const fields = [
      { id: "a", type: "text", label: "A" },
      { id: "a", type: "email", label: "B" },
    ];
    expect(errorsOf(withFields(fields))).toContain('fields.1.id: Duplicate field id "a"');
  });

  it("rejects min above max", () => {
    expect(errorsOf(withFields([{ id: "n", type: "number", label: "N", min: 10, max: 5 }]))).toContain(
      "fields.0.max: Maximum is below the minimum",
    );
    expect(errorsOf(withFields([{ id: "t", type: "text", label: "T", minLength: 10, maxLength: 5 }]))).toContain(
      "fields.0.maxLength: Maximum length is below the minimum",
    );
  });

  describe("conditions (showIf)", () => {
    const select = { id: "s", type: "select", label: "S", options: [{ id: "o1", label: "One" }] };

    it("must point to an earlier field (no forward refs, no cycles)", () => {
      const fields = [
        { id: "a", type: "text", label: "A", showIf: { fieldId: "b", equals: "x" } },
        { id: "b", type: "text", label: "B", showIf: { fieldId: "a", equals: "y" } },
      ];
      expect(errorsOf(withFields(fields))).toContain("fields.0.showIf: Condition must refer to a field above this one");
    });

    it("can't point at itself", () => {
      expect(errorsOf(withFields([{ id: "a", type: "text", label: "A", showIf: { fieldId: "a", equals: "x" } }]))).toContain(
        "fields.0.showIf: Condition must refer to a field above this one",
      );
    });

    it("can't depend on a field type with no comparable value", () => {
      const fields = [
        { id: "f", type: "file", label: "F" },
        { id: "b", type: "text", label: "B", showIf: { fieldId: "f", equals: "x" } },
      ];
      expect(errorsOf(withFields(fields))).toContain("fields.1.showIf: A file field can't be used as a condition");
    });

    it("must name an existing option for a select", () => {
      const fields = [select, { id: "b", type: "text", label: "B", showIf: { fieldId: "s", equals: "nope" } }];
      expect(errorsOf(withFields(fields))).toContain("fields.1.showIf: Condition refers to an option that doesn't exist");
      const ok = [select, { id: "b", type: "text", label: "B", showIf: { fieldId: "s", equals: "o1" } }];
      expect(parseFormSchema(withFields(ok)).ok).toBe(true);
    });
  });

  it("type-checks the sample form as a FormSchema", () => {
    const form: FormSchema = tutoringIntake;
    expect(form.fields).toHaveLength(10);
  });
});

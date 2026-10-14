import { describe, expect, it } from "vitest";
import { tutoringIntake as form } from "./test-forms.js";
import { fileMatchesAccept, validateSubmission, visibleFieldIds, type FormValues } from "./validation.js";

const valid: FormValues = { name: "Sam", email: "sam@example.com", level: "GCSE", consent: true };

describe("visibleFieldIds", () => {
  it("hides conditional fields until their condition is met", () => {
    const hidden = visibleFieldIds(form, {});
    expect(hidden.has("board")).toBe(false);
    expect(hidden.has("report")).toBe(false);

    const shown = visibleFieldIds(form, { level: "A-level", hasReport: true });
    expect(shown.has("board")).toBe(true);
    expect(shown.has("report")).toBe(true);
  });

  it("matches text conditions case- and space-insensitively", () => {
    const f = {
      ...form,
      fields: [
        { id: "a", type: "text" as const, label: "A", required: false },
        { id: "b", type: "text" as const, label: "B", required: false, showIf: { fieldId: "a", equals: "Yes" } },
      ],
    };
    expect(visibleFieldIds(f, { a: "  yes " }).has("b")).toBe(true);
    expect(visibleFieldIds(f, { a: "no" }).has("b")).toBe(false);
  });

  it("hides a field whose condition depends on a hidden field (chains)", () => {
    const f = {
      ...form,
      fields: [
        { id: "a", type: "checkbox" as const, label: "A", required: false },
        { id: "b", type: "text" as const, label: "B", required: false, showIf: { fieldId: "a", equals: true } },
        { id: "c", type: "text" as const, label: "C", required: false, showIf: { fieldId: "b", equals: "go" } },
      ],
    };
    // b says "go" but b itself is hidden (a unchecked), so c stays hidden.
    expect([...visibleFieldIds(f, { a: false, b: "go" })]).toEqual(["a"]);
    expect([...visibleFieldIds(f, { a: true, b: "go" })]).toEqual(["a", "b", "c"]);
  });
});

describe("validateSubmission", () => {
  it("accepts a minimal valid submission and normalises blanks to null", () => {
    const result = validateSubmission(form, { ...valid, age: "", start: "" });
    expect(result).toEqual({
      ok: true,
      data: { name: "Sam", email: "sam@example.com", age: null, level: "GCSE", hasReport: false, start: null, consent: true },
    });
  });

  it("reports every problem at once, keyed by field id", () => {
    const result = validateSubmission(form, { name: "  ", email: "nope", age: "4.5", level: "PhD", start: "2026-09-01" });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.errors).toEqual({
        name: "This field is required",
        email: "Enter a valid email address",
        age: "Enter a whole number",
        level: "Choose one of the options",
        start: "Must be on or after 2026-10-01",
        consent: "This field is required",
      });
  });

  it("requires a visible conditional field but ignores it when hidden", () => {
    const hidden = validateSubmission(form, { ...valid, board: "" });
    expect(hidden.ok).toBe(true);

    const shown = validateSubmission(form, { ...valid, level: "A-level", board: "" });
    expect(!shown.ok && shown.errors.board).toBe("This field is required");
  });

  it("drops answers to hidden questions from the stored data", () => {
    const result = validateSubmission(form, { ...valid, board: "AQA" });
    expect(result.ok && "board" in result.data).toBe(false);
  });

  it("coerces numbers and enforces min/max", () => {
    expect(validateSubmission(form, { ...valid, age: "17" })).toMatchObject({ ok: true, data: { age: 17 } });
    const low = validateSubmission(form, { ...valid, age: "3" });
    expect(!low.ok && low.errors.age).toBe("Must be at least 5");
    const word = validateSubmission(form, { ...valid, age: "twelve" });
    expect(!word.ok && word.errors.age).toBe("Enter a number");
  });

  it("checks file metadata against type and size limits", () => {
    const base = { ...valid, hasReport: true };
    expect(validateSubmission(form, { ...base, report: { name: "r.pdf", size: 1000, type: "application/pdf" } }).ok).toBe(true);
    const wrongType = validateSubmission(form, { ...base, report: { name: "r.png", size: 1000, type: "image/png" } });
    expect(!wrongType.ok && wrongType.errors.report).toBe("File type not allowed (.pdf)");
    const tooBig = validateSubmission(form, { ...base, report: { name: "r.pdf", size: 6 * 1024 * 1024, type: "application/pdf" } });
    expect(!tooBig.ok && tooBig.errors.report).toBe("File must be under 5 MB");
    const missing = validateSubmission(form, base);
    expect(!missing.ok && missing.errors.report).toBe("This field is required");
  });
});

describe("fileMatchesAccept", () => {
  const png = { name: "Photo.PNG", size: 1, type: "image/png" };
  it.each([
    [undefined, true],
    ["", true],
    [".png", true],
    ["image/*", true],
    ["image/png", true],
    [".pdf, .doc", false],
    ["application/*", false],
  ])("accept=%j → %s", (accept, expected) => {
    expect(fileMatchesAccept(png, accept)).toBe(expected);
  });
});

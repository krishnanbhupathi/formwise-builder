import { parseFormSchema, type Field, type FormSchema } from "@formwise/renderer";
import { describe, expect, it } from "vitest";
import { applyCommand, createField, emptyForm, FIELD_LABELS, type Command } from "./commands";

const select: Field = {
  id: "level",
  type: "select",
  label: "Level",
  required: true,
  options: [
    { id: "gcse", label: "GCSE" },
    { id: "alevel", label: "A-level" },
  ],
};
const board: Field = { id: "board", type: "text", label: "Board", required: false, showIf: { fieldId: "level", equals: "alevel" } };
const name: Field = { id: "name", type: "text", label: "Name", required: true };
const base: FormSchema = { ...emptyForm("f"), fields: [name, select, board] };

const run = (form: FormSchema, ...commands: Command[]) =>
  commands.reduce((acc, c) => {
    const r = applyCommand(acc.form, c);
    return { form: r.form, cleared: [...acc.cleared, ...r.clearedConditions] };
  }, { form, cleared: [] as string[] });
const ids = (form: FormSchema) => form.fields.map((f) => f.id);

describe("applyCommand", () => {
  it("never mutates the input form", () => {
    const frozen = structuredClone(base);
    applyCommand(base, { type: "removeField", id: "level" });
    applyCommand(base, { type: "updateField", id: "name", patch: { label: "X" } });
    expect(base).toEqual(frozen);
  });

  it("returns the same object when nothing changes (cheap no-op detection)", () => {
    expect(applyCommand(base, { type: "removeField", id: "missing" }).form).toBe(base);
    expect(applyCommand(base, { type: "moveField", id: "name", toIndex: 0 }).form).toBe(base);
  });

  it.each(Object.keys(FIELD_LABELS) as (keyof typeof FIELD_LABELS)[])("adds a valid %s field", (fieldType) => {
    const { form } = run(emptyForm("f"), { type: "addField", fieldType, id: "new" });
    expect(form.fields[0]).toMatchObject({ id: "new", type: fieldType });
    expect(parseFormSchema(form).ok).toBe(true);
  });

  it("adds at an index, clamped to the list", () => {
    expect(ids(run(base, { type: "addField", fieldType: "email", index: 1, id: "e" }).form)).toEqual(["name", "e", "level", "board"]);
    expect(ids(run(base, { type: "addField", fieldType: "email", index: 99, id: "e" }).form)).toEqual(["name", "level", "board", "e"]);
  });

  it("moves fields", () => {
    expect(ids(run(base, { type: "moveField", id: "name", toIndex: 2 }).form)).toEqual(["level", "board", "name"]);
  });

  it("clears a condition when its field is moved above the question it depends on", () => {
    const { form, cleared } = run(base, { type: "moveField", id: "board", toIndex: 0 });
    expect(ids(form)).toEqual(["board", "name", "level"]);
    expect(form.fields[0]!.showIf).toBeUndefined();
    expect(cleared).toEqual(["board"]);
  });

  it("clears dependent conditions when a field is removed", () => {
    const { form, cleared } = run(base, { type: "removeField", id: "level" });
    expect(ids(form)).toEqual(["name", "board"]);
    expect(form.fields[1]!.showIf).toBeUndefined();
    expect(cleared).toEqual(["board"]);
  });

  it("clears a condition when the option it pointed at is deleted", () => {
    const { form, cleared } = run(base, { type: "updateField", id: "level", patch: { options: [{ id: "gcse", label: "GCSE" }] } });
    expect(form.fields[2]!.showIf).toBeUndefined();
    expect(cleared).toEqual(["board"]);
  });

  it("keeps a condition when the option is only renamed", () => {
    const options = [
      { id: "gcse", label: "GCSE" },
      { id: "alevel", label: "A level" },
    ];
    const { form, cleared } = run(base, { type: "updateField", id: "level", patch: { options } });
    expect(form.fields[2]!.showIf).toEqual({ fieldId: "level", equals: "alevel" });
    expect(cleared).toEqual([]);
  });

  it("updates properties and removes blank ones", () => {
    const { form } = run(
      base,
      { type: "updateField", id: "name", patch: { label: "Full name", placeholder: "Jo", maxLength: 50 } },
      { type: "updateField", id: "name", patch: { placeholder: "", maxLength: undefined } },
    );
    expect(form.fields[0]).toEqual({ id: "name", type: "text", label: "Full name", required: true });
  });

  it("duplicates a field right after the original with fresh ids", () => {
    const { form } = run(base, { type: "duplicateField", id: "level", newId: "level2" });
    expect(ids(form)).toEqual(["name", "level", "level2", "board"]);
    const copy = form.fields[2] as Extract<Field, { type: "select" }>;
    expect(copy.options.map((o) => o.label)).toEqual(["GCSE", "A-level"]);
    expect(copy.options.map((o) => o.id)).not.toContain("gcse");
    expect(parseFormSchema(form).ok).toBe(true);
  });

  it("updates the title and clears an empty description", () => {
    const { form } = run(base, { type: "updateForm", patch: { title: "Intake", description: "Hi" } }, { type: "updateForm", patch: { description: "" } });
    expect(form.title).toBe("Intake");
    expect("description" in form).toBe(false);
  });

  it("keeps every result a valid schema across a random edit sequence", () => {
    let form = base;
    const types = Object.keys(FIELD_LABELS) as (keyof typeof FIELD_LABELS)[];
    let seed = 7;
    const rand = (n: number) => (seed = (seed * 16807) % 2147483647) % n;
    for (let step = 0; step < 300; step++) {
      const target = form.fields[rand(Math.max(form.fields.length, 1))];
      const options: Command[] = [
        { type: "addField", fieldType: types[rand(types.length)]!, index: rand(form.fields.length + 1) },
        ...(target
          ? ([
              { type: "moveField", id: target.id, toIndex: rand(form.fields.length) },
              { type: "removeField", id: target.id },
              { type: "duplicateField", id: target.id },
            ] as Command[])
          : []),
      ];
      form = applyCommand(form, options[rand(options.length)]!).form;
      const parsed = parseFormSchema(form);
      if (!parsed.ok) throw new Error(`step ${step}: ${parsed.errors.join("; ")}`);
    }
  });
});

describe("createField", () => {
  it("gives selects two starter options with unique ids", () => {
    const f = createField("select", "s") as Extract<Field, { type: "select" }>;
    expect(new Set(f.options.map((o) => o.id)).size).toBe(2);
  });
});

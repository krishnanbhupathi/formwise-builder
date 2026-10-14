import { describe, expect, it } from "vitest";
import { emptyForm } from "./commands";
import { createBuilderStore } from "./store";

describe("builder store", () => {
  it("selects a newly added field and clears selection when it is removed", () => {
    const store = createBuilderStore(emptyForm("f"));
    store.getState().dispatch({ type: "addField", fieldType: "text", id: "a" });
    expect(store.getState().selectedId).toBe("a");
    store.getState().dispatch({ type: "removeField", id: "a" });
    expect(store.getState().selectedId).toBeNull();
  });

  it("selects the copy after duplicating", () => {
    const store = createBuilderStore(emptyForm("f"));
    store.getState().dispatch({ type: "addField", fieldType: "text", id: "a" });
    store.getState().dispatch({ type: "duplicateField", id: "a", newId: "b" });
    expect(store.getState().selectedId).toBe("b");
  });

  it("explains when a change removes a condition", () => {
    const store = createBuilderStore(emptyForm("f"));
    const { dispatch } = store.getState();
    dispatch({ type: "addField", fieldType: "checkbox", id: "c" });
    dispatch({ type: "addField", fieldType: "text", id: "t" });
    dispatch({ type: "updateField", id: "t", patch: { label: "Details", showIf: { fieldId: "c", equals: true } } });
    expect(store.getState().notice).toBeNull();
    dispatch({ type: "removeField", id: "c" });
    expect(store.getState().notice).toMatch(/"Details"/);
    store.getState().dismissNotice();
    expect(store.getState().notice).toBeNull();
  });

  describe("undo/redo", () => {
    const setup = () => {
      const store = createBuilderStore(emptyForm("f"));
      return { store, s: () => store.getState() };
    };

    it("undoes and redoes commands", () => {
      const { s } = setup();
      s().dispatch({ type: "addField", fieldType: "text", id: "a" });
      s().dispatch({ type: "addField", fieldType: "email", id: "b" });
      s().undo();
      expect(s().form.fields.map((f) => f.id)).toEqual(["a"]);
      s().redo();
      expect(s().form.fields.map((f) => f.id)).toEqual(["a", "b"]);
      expect(s().canUndo).toBe(true);
      expect(s().canRedo).toBe(false);
    });

    it("treats a burst of typing in one property as a single step", () => {
      const { s } = setup();
      s().dispatch({ type: "addField", fieldType: "text", id: "a" });
      for (const label of ["N", "Na", "Nam", "Name"]) s().dispatch({ type: "updateField", id: "a", patch: { label } }, { typing: true });
      expect(s().form.fields[0]!.label).toBe("Name");
      s().undo();
      expect(s().form.fields[0]!.label).toBe("Untitled question");
    });

    it("does not merge typing into different fields or properties", () => {
      const { s } = setup();
      s().dispatch({ type: "addField", fieldType: "text", id: "a" });
      s().dispatch({ type: "updateField", id: "a", patch: { label: "A" } }, { typing: true });
      s().dispatch({ type: "updateField", id: "a", patch: { helpText: "h" } }, { typing: true });
      s().undo();
      expect(s().form.fields[0]).toMatchObject({ label: "A" });
      expect(s().form.fields[0]!.helpText).toBeUndefined();
    });

    it("restores a condition that a deletion removed, and clears the notice", () => {
      const { s } = setup();
      s().dispatch({ type: "addField", fieldType: "checkbox", id: "c" });
      s().dispatch({ type: "addField", fieldType: "text", id: "t" });
      s().dispatch({ type: "updateField", id: "t", patch: { showIf: { fieldId: "c", equals: true } } });
      s().dispatch({ type: "removeField", id: "c" });
      expect(s().notice).not.toBeNull();
      s().undo();
      expect(s().form.fields.map((f) => f.id)).toEqual(["c", "t"]);
      expect(s().form.fields[1]!.showIf).toEqual({ fieldId: "c", equals: true });
      expect(s().notice).toBeNull();
    });

    it("drops the selection if the selected field no longer exists after undo", () => {
      const { s } = setup();
      s().dispatch({ type: "addField", fieldType: "text", id: "a" });
      expect(s().selectedId).toBe("a");
      s().undo();
      expect(s().selectedId).toBeNull();
    });

    it("ignores no-op commands (nothing to undo)", () => {
      const { s } = setup();
      s().dispatch({ type: "removeField", id: "missing" });
      expect(s().canUndo).toBe(false);
    });

    it("loading a form starts a fresh history; importing one can be undone", () => {
      const { s } = setup();
      s().dispatch({ type: "addField", fieldType: "text", id: "a" });
      s().load({ ...emptyForm("g"), title: "Loaded" });
      expect(s().canUndo).toBe(false);
      expect(s().form.title).toBe("Loaded");

      s().dispatch({ type: "replaceForm", form: { ...emptyForm("g"), title: "Imported" } });
      s().undo();
      expect(s().form.title).toBe("Loaded");
    });
  });
});

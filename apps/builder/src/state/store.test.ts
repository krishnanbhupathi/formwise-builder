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
});

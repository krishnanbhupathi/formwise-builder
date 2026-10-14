import { describe, expect, it } from "vitest";
import { canRedo, canUndo, COALESCE_MS, HISTORY_LIMIT, initHistory, record, redo, undo } from "./history";

describe("history", () => {
  it("undoes and redoes in order", () => {
    let h = initHistory("a");
    h = record(h, "b", { now: 0 });
    h = record(h, "c", { now: 5000 });
    expect(h.present).toBe("c");
    h = undo(h);
    expect(h.present).toBe("b");
    h = undo(h);
    expect(h.present).toBe("a");
    expect(canUndo(h)).toBe(false);
    h = redo(h);
    h = redo(h);
    expect(h.present).toBe("c");
    expect(canRedo(h)).toBe(false);
  });

  it("undo/redo at the ends are no-ops that return the same history", () => {
    const h = initHistory("a");
    expect(undo(h)).toBe(h);
    expect(redo(h)).toBe(h);
  });

  it("a new change after undo discards the redo branch", () => {
    let h = record(record(initHistory("a"), "b", { now: 0 }), "c", { now: 5000 });
    h = undo(h);
    h = record(h, "x", { now: 10000 });
    expect(canRedo(h)).toBe(false);
    expect(undo(h).present).toBe("b");
  });

  it("merges rapid changes with the same key into one step (typing)", () => {
    let h = initHistory("");
    for (const [i, text] of ["F", "Fu", "Ful", "Full"].entries()) h = record(h, text, { key: "label", now: i * 200 });
    expect(h.past).toEqual([""]);
    expect(undo(h).present).toBe("");
  });

  it("keeps merging while typing continues, but starts a new step after a pause", () => {
    let h = initHistory("");
    h = record(h, "a", { key: "k", now: 0 });
    h = record(h, "ab", { key: "k", now: COALESCE_MS - 1 });
    h = record(h, "abc", { key: "k", now: 2 * COALESCE_MS + 10 });
    expect(h.past).toEqual(["", "ab"]);
  });

  it("does not merge different keys or unkeyed changes", () => {
    let h = initHistory("0");
    h = record(h, "1", { key: "label", now: 0 });
    h = record(h, "2", { key: "help", now: 10 });
    h = record(h, "3", { now: 20 });
    h = record(h, "4", { now: 30 });
    expect(h.past).toEqual(["0", "1", "2", "3"]);
  });

  it("never merges across an undo", () => {
    let h = initHistory("");
    h = record(h, "a", { key: "k", now: 0 });
    h = record(h, "ab", { key: "k", now: 10 });
    h = undo(h);
    h = record(h, "x", { key: "k", now: 20 });
    expect(h.past).toEqual([""]);
    expect(undo(h).present).toBe("");
  });

  it(`keeps at most ${HISTORY_LIMIT} undo steps`, () => {
    let h = initHistory(0);
    for (let i = 1; i <= HISTORY_LIMIT + 20; i++) h = record(h, i, { now: i * 10_000 });
    expect(h.past).toHaveLength(HISTORY_LIMIT);
    expect(h.past[0]).toBe(20);
  });
});

import { describe, expect, it } from "vitest";
import { draftOutputSchema } from "./output-schema.js";

const UNSUPPORTED = ["maxItems", "minItems", "maxLength", "minLength", "pattern", "minimum", "maximum", "$schema"];

function walk(node: unknown, visit: (obj: Record<string, unknown>) => void) {
  if (Array.isArray(node)) node.forEach((n) => walk(n, visit));
  else if (node && typeof node === "object") {
    visit(node as Record<string, unknown>);
    Object.values(node).forEach((n) => walk(n, visit));
  }
}

describe("draftOutputSchema", () => {
  it("uses only keywords structured outputs accept", () => {
    walk(draftOutputSchema, (obj) => {
      for (const k of UNSUPPORTED) expect(obj).not.toHaveProperty(k);
    });
  });

  it("closes every object", () => {
    let objects = 0;
    walk(draftOutputSchema, (obj) => {
      if (obj.type === "object") {
        objects++;
        expect(obj.additionalProperties).toBe(false);
      }
    });
    expect(objects).toBeGreaterThan(1);
  });
});

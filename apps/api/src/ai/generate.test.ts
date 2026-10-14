import { describe, expect, it, vi } from "vitest";
import type { DraftForm } from "./draft.js";
import { generateForm, MAX_ATTEMPTS, type CallModel, type ModelTurn } from "./generate.js";

const turn = (output: unknown): ModelTurn => ({ output, text: JSON.stringify(output) ?? "", inputTokens: 100, outputTokens: 50 });
const good: DraftForm = {
  title: "Contact",
  fields: [
    { key: "name", type: "text", label: "Name", required: true },
    { key: "email", type: "email", label: "Email", required: true },
  ],
};

describe("generateForm", () => {
  it("returns a valid form from a good first answer", async () => {
    const model = vi.fn<CallModel>().mockResolvedValue(turn(good));
    const result = await generateForm("a contact form", model, "form_x");
    expect(result).toMatchObject({ ok: true, attempts: 1, inputTokens: 100, outputTokens: 50, form: { id: "form_x", title: "Contact" } });
    expect(model).toHaveBeenCalledWith({ description: "a contact form" });
  });

  it("retries once with the exact validation errors, then succeeds", async () => {
    const bad = { ...good, fields: [{ key: "a", type: "text", label: "A", required: false, showIf: { key: "nope", equals: "x" } }] };
    const model = vi.fn<CallModel>().mockResolvedValueOnce(turn(bad)).mockResolvedValueOnce(turn(good));
    const result = await generateForm("x", model, "f");
    expect(result).toMatchObject({ ok: true, attempts: 2, inputTokens: 200, outputTokens: 100 });
    expect(model.mock.calls[1]![0].retry!.errors).toEqual(["fields.0.showIf: Condition must refer to a field above this one"]);
  });

  it("reports shape errors from the draft schema too", async () => {
    const model = vi.fn<CallModel>().mockResolvedValueOnce(turn({ title: "T", fields: [{ key: "Bad Key!", type: "text", label: "A", required: true }] })).mockResolvedValueOnce(turn(good));
    await generateForm("x", model, "f");
    expect(model.mock.calls[1]![0].retry!.errors[0]).toMatch(/^fields\.0\.key:/);
  });

  it("treats a non-JSON answer as invalid and retries", async () => {
    const model = vi.fn<CallModel>().mockResolvedValueOnce({ output: undefined, text: "oops", inputTokens: 1, outputTokens: 1 }).mockResolvedValueOnce(turn(good));
    const result = await generateForm("x", model, "f");
    expect(result).toMatchObject({ ok: true, attempts: 2 });
    expect(model.mock.calls[1]![0].retry!.previous.text).toBe("oops");
  });

  it("rejects a form with only headings", async () => {
    const model = vi.fn<CallModel>().mockResolvedValue(turn({ title: "T", fields: [{ key: "h", type: "heading", label: "H", required: false }] }));
    const result = await generateForm("x", model, "f");
    expect(result).toMatchObject({ ok: false, attempts: MAX_ATTEMPTS });
    expect(model).toHaveBeenCalledTimes(MAX_ATTEMPTS);
  });

  it("gives up after the retry with a friendly message and the total usage", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const model = vi.fn<CallModel>().mockResolvedValue(turn(undefined));
    expect(await generateForm("x", model, "f")).toEqual({
      ok: false,
      error: "Couldn't build a valid form from that description. Try rephrasing it.",
      attempts: 2,
      inputTokens: 200,
      outputTokens: 100,
    });
  });
});

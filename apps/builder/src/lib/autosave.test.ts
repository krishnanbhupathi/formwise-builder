import type { FormSchema } from "@formwise/renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, type OwnedForm } from "./api";
import { AUTOSAVE_DELAY_MS, createAutosaver } from "./autosave";

const form = (title: string): FormSchema => ({ version: 1, id: "f", title, fields: [] });
const owned = (f: FormSchema, revision: number): OwnedForm => ({ id: "f", form: f, revision, publishedVersion: null, publishedRevision: null, updatedAt: "" });

let current: FormSchema;
let saves: { title: string; revision: number }[];
let saveImpl: (f: FormSchema, revision: number) => Promise<OwnedForm>;

function setup() {
  const initial = owned(current, 1);
  return createAutosaver(initial, {
    getForm: () => current,
    save: (f, revision) => {
      saves.push({ title: f.title, revision });
      return saveImpl(f, revision);
    },
    publish: async (revision) => ({ ...owned(current, revision), publishedVersion: 1, publishedRevision: revision }),
  });
}
const edit = (saver: ReturnType<typeof setup>, title: string) => {
  current = form(title);
  saver.changed();
};

beforeEach(() => {
  vi.useFakeTimers();
  current = form("start");
  saves = [];
  saveImpl = async (f, revision) => owned(f, revision + 1);
});
afterEach(() => vi.useRealTimers());

describe("autosave", () => {
  it("waits for a pause, then saves the latest form once", async () => {
    const saver = setup();
    edit(saver, "a");
    edit(saver, "ab");
    expect(saver.getState().status).toBe("pending");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS - 1);
    expect(saves).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(saves).toEqual([{ title: "ab", revision: 1 }]);
    expect(saver.getState()).toMatchObject({ status: "saved", server: { revision: 2 } });
  });

  it("returns to 'saved' without a request when an edit is undone back to the saved form", async () => {
    const saver = setup();
    const original = current;
    edit(saver, "x");
    current = original;
    saver.changed();
    expect(saver.getState().status).toBe("saved");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);
    expect(saves).toEqual([]);
  });

  it("saves edits made during a request right after it, with the new revision", async () => {
    let release!: () => void;
    saveImpl = (f, revision) => new Promise((resolve) => (release = () => resolve(owned(f, revision + 1))));
    const saver = setup();
    edit(saver, "first");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    edit(saver, "second"); // while "first" is in flight
    const done = saver.save();
    release();
    await vi.advanceTimersByTimeAsync(0);
    release();
    await done;
    expect(saves).toEqual([
      { title: "first", revision: 1 },
      { title: "second", revision: 2 },
    ]);
    expect(saver.getState().status).toBe("saved");
  });

  it("stops on a conflict instead of overwriting another tab's changes", async () => {
    saveImpl = async () => {
      throw new ApiError(409, "Changed elsewhere");
    };
    const saver = setup();
    edit(saver, "mine");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(saver.getState()).toMatchObject({ status: "conflict", error: "Changed elsewhere" });
    edit(saver, "more");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS * 2);
    expect(saves).toHaveLength(1);
  });

  it("reports a network error and recovers on retry", async () => {
    saveImpl = async () => {
      throw new ApiError(0, "Offline");
    };
    const saver = setup();
    edit(saver, "x");
    await vi.advanceTimersByTimeAsync(AUTOSAVE_DELAY_MS);
    expect(saver.getState().status).toBe("error");
    saveImpl = async (f, revision) => owned(f, revision + 1);
    expect(await saver.save()).toBe(true);
    expect(saver.getState().status).toBe("saved");
  });

  it("publish saves pending edits first, then publishes that revision", async () => {
    const saver = setup();
    edit(saver, "ready");
    const result = await saver.publish();
    expect(saves).toEqual([{ title: "ready", revision: 1 }]);
    expect(result.publishedRevision).toBe(2);
  });

  it("publish refuses when the save fails", async () => {
    saveImpl = async () => {
      throw new ApiError(500, "Server error");
    };
    const saver = setup();
    edit(saver, "x");
    await expect(saver.publish()).rejects.toThrow("Server error");
  });
});

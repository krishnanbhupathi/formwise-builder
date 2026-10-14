import type { FormSchema } from "@formwise/renderer";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useBuilder } from "../state/store";
import { api, ApiError, type OwnedForm } from "./api";
import { rememberForm } from "./owned-forms";

export const AUTOSAVE_DELAY_MS = 800;

export type SaveStatus = "saved" | "pending" | "saving" | "error" | "conflict";
export type AutosaveState = { status: SaveStatus; error: string | null; server: OwnedForm };

type Deps = {
  getForm: () => FormSchema;
  save: (form: FormSchema, revision: number) => Promise<OwnedForm>;
  publish: (revision: number) => Promise<OwnedForm>;
  onSaved?: (result: OwnedForm) => void;
  delayMs?: number;
};

/**
 * Saves a form a moment after edits stop. One request at a time; edits made
 * during a request are saved after it. A 409 (saved from another tab) stops
 * autosave instead of overwriting. Plain TypeScript, so it's unit-tested
 * without React; `useAutosave` wires it to the builder store.
 */
export function createAutosaver(initial: OwnedForm, deps: Deps) {
  let state: AutosaveState = { status: "saved", error: null, server: initial };
  let saved = initial.form;
  let inFlight: Promise<boolean> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  const listeners = new Set<() => void>();
  const set = (patch: Partial<AutosaveState>) => {
    state = { ...state, ...patch };
    listeners.forEach((fn) => fn());
  };
  const dirty = () => deps.getForm() !== saved;

  async function attempt(form: FormSchema): Promise<boolean> {
    set({ status: "saving" });
    try {
      const result = await deps.save(form, state.server.revision);
      saved = form;
      set({ server: result, error: null, status: dirty() ? "pending" : "saved" });
      deps.onSaved?.(result);
      return true;
    } catch (e) {
      const conflict = e instanceof ApiError && e.status === 409;
      if (conflict) stopped = true;
      set({ status: conflict ? "conflict" : "error", error: e instanceof Error ? e.message : "Couldn't save" });
      return false;
    }
  }

  /** Saves until the store matches the server. Resolves false if a save failed. */
  async function save(): Promise<boolean> {
    clearTimeout(timer);
    while (inFlight) await inFlight;
    while (!stopped && dirty()) {
      inFlight = attempt(deps.getForm());
      const ok = await inFlight;
      inFlight = null;
      if (!ok) return false;
    }
    return !stopped;
  }

  return {
    getState: () => state,
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    /** Call whenever the form changes. */
    changed() {
      if (stopped || state.status === "saving") return;
      set({ status: dirty() ? "pending" : "saved" });
      clearTimeout(timer);
      if (dirty()) timer = setTimeout(() => void save(), deps.delayMs ?? AUTOSAVE_DELAY_MS);
    },
    save,
    isDirty: dirty,
    /** Saves, then publishes exactly the saved revision. */
    async publish() {
      if (!(await save())) throw new Error(state.error ?? "Couldn't save the latest changes");
      const result = await deps.publish(state.server.revision);
      set({ server: result });
      return result;
    },
    dispose() {
      clearTimeout(timer);
      listeners.clear();
    },
  };
}

export type Autosaver = ReturnType<typeof createAutosaver>;

export function useAutosave(id: string, token: string, initial: OwnedForm) {
  const [saver] = useState(() =>
    createAutosaver(initial, {
      getForm: () => useBuilder.getState().form,
      save: (form, revision) => api.saveForm(id, token, form, revision),
      publish: (revision) => api.publish(id, token, revision),
      onSaved: (result) => rememberForm({ id, token, title: result.form.title, updatedAt: result.updatedAt }),
    }),
  );
  const state = useSyncExternalStore(saver.subscribe, saver.getState);

  useEffect(() => {
    const unsubscribe = useBuilder.subscribe((s, prev) => s.form !== prev.form && saver.changed());
    // Warn before closing the tab with unsaved edits.
    const onBeforeUnload = (e: BeforeUnloadEvent) => saver.isDirty() && e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      unsubscribe();
      window.removeEventListener("beforeunload", onBeforeUnload);
      // Leaving the editor inside the app (e.g. Back): don't drop a pending edit.
      if (saver.isDirty()) void saver.save();
      saver.dispose();
    };
  }, [saver]);

  return { ...state, saver };
}

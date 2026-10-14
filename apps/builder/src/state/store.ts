import type { FormSchema } from "@formwise/renderer";
import { create } from "zustand";
import { sampleForm } from "../sample";
import { applyCommand, emptyForm, type Command } from "./commands";
import * as history from "./history";

export type DispatchOptions = {
  /** The change comes from typing: merge it with the previous keystrokes into one undo step. */
  typing?: boolean;
};

export type BuilderState = {
  form: FormSchema;
  selectedId: string | null;
  /** A short, dismissable message about a side effect (e.g. a removed condition). */
  notice: string | null;
  canUndo: boolean;
  canRedo: boolean;
  dispatch: (command: Command, options?: DispatchOptions) => void;
  undo: () => void;
  redo: () => void;
  /** Opens a form (e.g. from the server) with a fresh history. */
  load: (form: FormSchema) => void;
  select: (id: string | null) => void;
  dismissNotice: () => void;
};

/** Typing into the same property of the same field (or form) merges. */
function typingKey(command: Command): string | null {
  if (command.type === "updateField") return `field:${command.id}:${Object.keys(command.patch).sort().join(",")}`;
  if (command.type === "updateForm") return `form:${Object.keys(command.patch).sort().join(",")}`;
  return null;
}

export const createBuilderStore = (initial: FormSchema = emptyForm(), { now = () => Date.now() } = {}) =>
  create<BuilderState>()((set, get) => {
    let h = history.initHistory(initial);

    /** Moves to another snapshot (undo/redo/load) and fixes up dependent UI state. */
    const show = (next: history.History<FormSchema>) => {
      h = next;
      const { selectedId } = get();
      set({
        form: h.present,
        selectedId: h.present.fields.some((f) => f.id === selectedId) ? selectedId : null,
        notice: null,
        canUndo: history.canUndo(h),
        canRedo: history.canRedo(h),
      });
    };

    return {
      form: initial,
      selectedId: null,
      notice: null,
      canUndo: false,
      canRedo: false,

      dispatch: (command, options = {}) => {
        const { form, selectedId } = get();
        const result = applyCommand(form, command);
        if (result.form === form) return;
        h = history.record(h, result.form, { key: options.typing ? typingKey(command) : null, now: now() });

        let nextSelected = selectedId;
        if (command.type === "addField") nextSelected = result.form.fields.find((f) => !form.fields.some((g) => g.id === f.id))?.id ?? null;
        if (command.type === "duplicateField") {
          const i = result.form.fields.findIndex((f) => f.id === command.id);
          nextSelected = result.form.fields[i + 1]?.id ?? selectedId;
        }
        if (!result.form.fields.some((f) => f.id === nextSelected)) nextSelected = null;

        const names = result.clearedConditions.map((id) => `"${result.form.fields.find((f) => f.id === id)?.label ?? id}"`);
        set({
          form: result.form,
          selectedId: nextSelected,
          notice: names.length
            ? `Removed the show-if condition from ${names.join(", ")} because the question it depended on moved or changed. Undo to restore it.`
            : get().notice,
          canUndo: history.canUndo(h),
          canRedo: false,
        });
      },
      undo: () => show(history.undo(h)),
      redo: () => show(history.redo(h)),
      load: (form) => show(history.initHistory(form)),
      select: (id) => set({ selectedId: id }),
      dismissNotice: () => set({ notice: null }),
    };
  });

export const useBuilder = createBuilderStore(sampleForm);

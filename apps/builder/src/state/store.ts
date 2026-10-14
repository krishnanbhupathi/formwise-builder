import type { FormSchema } from "@formwise/renderer";
import { create } from "zustand";
import { sampleForm } from "../sample";
import { applyCommand, emptyForm, type Command } from "./commands";

export type BuilderState = {
  form: FormSchema;
  selectedId: string | null;
  /** A short, dismissable message about a side effect (e.g. a removed condition). */
  notice: string | null;
  dispatch: (command: Command) => void;
  select: (id: string | null) => void;
  dismissNotice: () => void;
};

export const createBuilderStore = (initial: FormSchema = emptyForm()) =>
  create<BuilderState>()((set, get) => ({
    form: initial,
    selectedId: null,
    notice: null,
    dispatch: (command) => {
      const { form, selectedId } = get();
      const result = applyCommand(form, command);
      if (result.form === form) return;

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
          ? `Removed the show-if condition from ${names.join(", ")} because the question it depended on moved or changed.`
          : get().notice,
      });
    },
    select: (id) => set({ selectedId: id }),
    dismissNotice: () => set({ notice: null }),
  }));

export const useBuilder = createBuilderStore(sampleForm);

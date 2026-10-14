import { canBeCondition, type Field, type SelectOption, type ShowIf } from "@formwise/renderer";
import { useId, type ReactNode } from "react";
import { newOptionId, type FieldPatch } from "../state/commands";
import { useBuilder, type DispatchOptions } from "../state/store";

type Update = (patch: FieldPatch, options?: DispatchOptions) => void;
const TYPING = { typing: true } as const;
import { fieldName, typeName } from "./field-meta";

/** Edits the selected field, or the form's title/description when none is selected. */
export function PropertiesPanel() {
  const form = useBuilder((s) => s.form);
  const selectedId = useBuilder((s) => s.selectedId);
  const dispatch = useBuilder((s) => s.dispatch);
  const index = form.fields.findIndex((f) => f.id === selectedId);
  const field = form.fields[index];

  if (!field) {
    return (
      <Section title="Form settings">
        <TextInput label="Title" value={form.title} maxLength={200} onChange={(title) => dispatch({ type: "updateForm", patch: { title } }, TYPING)} />
        <TextInput
          label="Description"
          multiline
          value={form.description ?? ""}
          maxLength={1000}
          onChange={(description) => dispatch({ type: "updateForm", patch: { description } }, TYPING)}
        />
        <p className="text-sm text-muted">Select a question on the canvas to edit it.</p>
      </Section>
    );
  }

  const update: Update = (patch, options) => dispatch({ type: "updateField", id: field.id, patch }, options);
  const earlier = form.fields.slice(0, index).filter(canBeCondition);

  return (
    <Section title={`${typeName(field.type)} settings`}>
      <TextInput label={field.type === "heading" ? "Heading" : "Question"} value={field.label} maxLength={200} onChange={(label) => update({ label }, TYPING)} />
      <TextInput label="Help text" value={field.helpText ?? ""} maxLength={500} onChange={(helpText) => update({ helpText }, TYPING)} />
      {field.type !== "heading" && <Toggle label="Required" checked={field.required} onChange={(required) => update({ required })} />}
      <TypeSettings field={field} update={update} />
      {field.type !== "heading" || earlier.length > 0 ? <ConditionEditor field={field} candidates={earlier} update={update} /> : null}
    </Section>
  );
}

function TypeSettings({ field, update }: { field: Field; update: Update }) {
  switch (field.type) {
    case "text":
    case "textarea":
      return (
        <>
          <TextInput label="Placeholder" value={field.placeholder ?? ""} maxLength={200} onChange={(placeholder) => update({ placeholder }, TYPING)} />
          <Pair>
            <NumberInput label="Min length" value={field.minLength} min={0} integer onChange={(minLength) => update({ minLength }, TYPING)} />
            <NumberInput label="Max length" value={field.maxLength} min={1} integer onChange={(maxLength) => update({ maxLength }, TYPING)} />
          </Pair>
          <RangeWarning min={field.minLength} max={field.maxLength} />
        </>
      );
    case "email":
      return <TextInput label="Placeholder" value={field.placeholder ?? ""} maxLength={200} onChange={(placeholder) => update({ placeholder }, TYPING)} />;
    case "number":
      return (
        <>
          <TextInput label="Placeholder" value={field.placeholder ?? ""} maxLength={200} onChange={(placeholder) => update({ placeholder }, TYPING)} />
          <Pair>
            <NumberInput label="Minimum" value={field.min} onChange={(min) => update({ min }, TYPING)} />
            <NumberInput label="Maximum" value={field.max} onChange={(max) => update({ max }, TYPING)} />
          </Pair>
          <RangeWarning min={field.min} max={field.max} />
          <Toggle label="Whole numbers only" checked={field.integer ?? false} onChange={(integer) => update({ integer: integer || undefined })} />
        </>
      );
    case "date":
      return (
        <Pair>
          <TextInput label="Earliest" type="date" value={field.min ?? ""} onChange={(min) => update({ min }, TYPING)} />
          <TextInput label="Latest" type="date" value={field.max ?? ""} onChange={(max) => update({ max }, TYPING)} />
        </Pair>
      );
    case "file":
      return (
        <>
          <TextInput label="Allowed types" placeholder=".pdf, image/*" value={field.accept ?? ""} maxLength={200} onChange={(accept) => update({ accept }, TYPING)} />
          <NumberInput label="Max size (MB)" value={field.maxSizeMb} min={0.1} max={100} onChange={(maxSizeMb) => update({ maxSizeMb }, TYPING)} />
        </>
      );
    case "select":
      return <OptionsEditor options={field.options} onChange={(options, typing) => update({ options }, typing ? TYPING : undefined)} />;
    default:
      return null;
  }
}

function OptionsEditor({ options, onChange }: { options: SelectOption[]; onChange: (options: SelectOption[], typing?: boolean) => void }) {
  const set = (i: number, label: string) => onChange(options.map((o, j) => (j === i ? { ...o, label } : o)), true);
  const move = (i: number, by: number) => {
    const next = [...options];
    const [o] = next.splice(i, 1);
    next.splice(i + by, 0, o!);
    onChange(next);
  };
  const labels = options.map((o) => o.label.trim());
  const hasDuplicates = new Set(labels).size !== labels.length;

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1 text-sm font-medium">Options</legend>
      <ol className="flex flex-col gap-1.5">
        {options.map((o, i) => (
          <li key={o.id} className="flex items-center gap-1">
            <input
              aria-label={`Option ${i + 1}`}
              value={o.label}
              maxLength={200}
              onChange={(e) => set(i, e.target.value)}
              onBlur={(e) => !e.target.value.trim() && set(i, `Option ${i + 1}`)}
              className="min-w-0 flex-1 rounded-md border border-line bg-panel px-2 py-1.5 text-sm"
            />
            <SmallButton label={`Move option ${i + 1} up`} disabled={i === 0} onClick={() => move(i, -1)}>↑</SmallButton>
            <SmallButton label={`Move option ${i + 1} down`} disabled={i === options.length - 1} onClick={() => move(i, 1)}>↓</SmallButton>
            <SmallButton label={`Remove option ${i + 1}`} disabled={options.length === 1} onClick={() => onChange(options.filter((_, j) => j !== i))}>✕</SmallButton>
          </li>
        ))}
      </ol>
      {hasDuplicates && <p className="text-xs text-danger">Two options have the same text; answers won't tell them apart.</p>}
      <button
        type="button"
        onClick={() => onChange([...options, { id: newOptionId(), label: `Option ${options.length + 1}` }])}
        disabled={options.length >= 100}
        className="self-start rounded-md px-2 py-1 text-sm font-medium text-accent hover:bg-accent-soft"
      >
        + Add option
      </button>
    </fieldset>
  );
}

function ConditionEditor({ field, candidates, update }: { field: Field; candidates: Field[]; update: Update }) {
  const id = useId();
  const rule = field.showIf;
  const target = candidates.find((c) => c.id === rule?.fieldId);

  const defaultFor = (t: Field): ShowIf["equals"] => (t.type === "select" ? (t.options[0]?.id ?? "") : t.type === "checkbox" ? true : "");
  const pickTarget = (targetId: string) => {
    const t = candidates.find((c) => c.id === targetId);
    update({ showIf: t ? { fieldId: t.id, equals: defaultFor(t) } : undefined });
  };
  const setEquals = (equals: ShowIf["equals"], options?: DispatchOptions) => target && update({ showIf: { fieldId: target.id, equals } }, options);

  return (
    <fieldset className="flex flex-col gap-2 border-t border-line pt-4">
      <legend className="sr-only">Visibility</legend>
      <label htmlFor={`${id}-target`} className="text-sm font-medium">Show this question</label>
      {candidates.length === 0 ? (
        <p className="text-sm text-muted">Always. To show it only for certain answers, add a dropdown, checkbox or short-answer question above it.</p>
      ) : (
        <>
          <select id={`${id}-target`} value={target?.id ?? ""} onChange={(e) => pickTarget(e.target.value)} className="rounded-md border border-line bg-panel px-2 py-1.5 text-sm">
            <option value="">Always</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>Only if “{fieldName(c)}”…</option>
            ))}
          </select>
          {target?.type === "select" && (
            <select aria-label="is" value={String(rule!.equals)} onChange={(e) => setEquals(e.target.value)} className="rounded-md border border-line bg-panel px-2 py-1.5 text-sm">
              {target.options.map((o) => (
                <option key={o.id} value={o.id}>is “{o.label}”</option>
              ))}
            </select>
          )}
          {target?.type === "checkbox" && (
            <select aria-label="is" value={String(rule!.equals)} onChange={(e) => setEquals(e.target.value === "true")} className="rounded-md border border-line bg-panel px-2 py-1.5 text-sm">
              <option value="true">is ticked</option>
              <option value="false">is not ticked</option>
            </select>
          )}
          {target?.type === "text" && (
            <TextInput label="equals (ignores case)" value={String(rule!.equals)} maxLength={200} onChange={(v) => setEquals(v, TYPING)} />
          )}
        </>
      )}
    </fieldset>
  );
}

// ---------------------------------------------------------------------------
// Small inputs
// ---------------------------------------------------------------------------

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Pair({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}

function TextInput(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  multiline?: boolean;
  type?: "text" | "date";
  placeholder?: string;
}) {
  const id = useId();
  const cls = "w-full rounded-md border border-line bg-panel px-2 py-1.5 text-sm";
  const onChange = props.onChange;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">{props.label}</label>
      {props.multiline ? (
        <textarea id={id} rows={3} className={cls} value={props.value} maxLength={props.maxLength} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input id={id} type={props.type ?? "text"} className={cls} value={props.value} maxLength={props.maxLength} placeholder={props.placeholder} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function NumberInput(props: { label: string; value: number | undefined; onChange: (v: number | undefined) => void; min?: number; max?: number; integer?: boolean }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">{props.label}</label>
      <input
        id={id}
        type="number"
        inputMode={props.integer ? "numeric" : "decimal"}
        min={props.min}
        max={props.max}
        step={props.integer ? 1 : "any"}
        value={props.value ?? ""}
        onChange={(e) => {
          const n = e.target.valueAsNumber;
          if (Number.isNaN(n)) return props.onChange(undefined);
          const clamped = Math.min(props.max ?? Infinity, Math.max(props.min ?? -Infinity, props.integer ? Math.round(n) : n));
          props.onChange(clamped);
        }}
        className="w-full rounded-md border border-line bg-panel px-2 py-1.5 text-sm"
      />
    </div>
  );
}

function RangeWarning({ min, max }: { min?: number; max?: number }) {
  return min !== undefined && max !== undefined && min > max ? (
    <p className="-mt-2 text-xs text-danger">The minimum is above the maximum, so no answer can pass.</p>
  ) : null;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-[var(--accent)]" />
      {label}
    </label>
  );
}

function SmallButton({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: string }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled} className="grid size-7 place-items-center rounded text-sm text-muted hover:bg-accent-soft disabled:opacity-30">
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

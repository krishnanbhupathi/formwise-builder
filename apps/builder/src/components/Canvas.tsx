import { parseFormSchema, type Field } from "@formwise/renderer";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useBuilder } from "../state/store";
import { codeFor, fieldName, typeName } from "./field-meta";

export const CANVAS_ID = "canvas";

export function Canvas({ dropTargetId }: { dropTargetId: string | null }) {
  const form = useBuilder((s) => s.form);
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_ID });
  const labels = new Map(form.fields.map((f) => [f.id, fieldName(f)]));
  const problems = problemsByIndex(form);
  // Question numbers skip section headings, matching the numbers on the public form.
  let n = 0;
  const numbers = form.fields.map((f) => (f.type === "heading" ? null : ++n));

  return (
    <section aria-label="Form canvas" className="fw-sheet flex min-w-0 flex-col gap-4">
      <FormHeader />
      <div
        ref={setNodeRef}
        className={`flex min-h-48 flex-col outline-2 outline-offset-4 transition-colors ${
          isOver || dropTargetId === CANVAS_ID ? "outline-accent outline-dashed" : "outline-transparent"
        }`}
      >
        <SortableContext items={form.fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-3.5" aria-label="Questions">
            {form.fields.map((field, i) => (
              <SortableField
                key={field.id}
                field={field}
                index={i}
                number={numbers[i]!}
                dependsOn={field.showIf ? labels.get(field.showIf.fieldId) : undefined}
                isDropTarget={dropTargetId === field.id}
                problem={problems.get(i)}
              />
            ))}
          </ol>
        </SortableContext>
        {form.fields.length === 0 && (
          <p className="grid min-h-40 place-items-center border-[1.5px] border-dashed border-ink bg-panel text-center text-sm text-muted">
            Drag a field here, or click one in the list to add it.
          </p>
        )}
      </div>
    </section>
  );
}

function FormHeader() {
  const form = useBuilder((s) => s.form);
  const selectedId = useBuilder((s) => s.selectedId);
  const select = useBuilder((s) => s.select);
  const active = selectedId === null;
  return (
    <button
      type="button"
      onClick={() => select(null)}
      aria-pressed={active}
      className={`-mx-2 px-2 py-1 text-left outline-2 outline-offset-2 focus-visible:outline-solid ${active ? "outline-dashed outline-accent" : "outline-transparent hover:outline-dashed hover:outline-line"}`}
    >
      <span className="block text-[1.75rem] leading-tight font-black tracking-[-0.025em] text-balance text-accent-dark">{form.title || "Untitled form"}</span>
      <span className="mt-1 block text-sm text-muted">{form.description || "Form settings: click to edit the title and description"}</span>
    </button>
  );
}

/** Schema errors keyed by field position ("fields.3.max: …" → 3). */
function problemsByIndex(form: Parameters<typeof parseFormSchema>[0]): Map<number, string> {
  const result = parseFormSchema(form);
  const map = new Map<number, string>();
  if (result.ok) return map;
  for (const error of result.errors) {
    const match = /^fields\.(\d+)\.[^:]*: (.*)$/.exec(error);
    if (match && !map.has(Number(match[1]))) map.set(Number(match[1]), match[2]!);
  }
  return map;
}

function SortableField(props: { field: Field; index: number; number: number | null; dependsOn?: string; isDropTarget: boolean; problem?: string }) {
  const { field, index, number, dependsOn, isDropTarget, problem } = props;
  const selectedId = useBuilder((s) => s.selectedId);
  const select = useBuilder((s) => s.select);
  const dispatch = useBuilder((s) => s.dispatch);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
    data: { from: "canvas" },
  });
  const selected = selectedId === field.id;
  const name = fieldName(field);
  const heading = field.type === "heading";
  const box = heading
    ? "border-x-0 border-t-0 border-b-2 border-b-ink bg-transparent"
    : selected
      ? "border-accent bg-panel shadow-[4px_4px_0_var(--ledger)]"
      : "border-ink bg-panel";

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative flex items-stretch border-[1.5px] ${box} ${heading && selected ? "outline-2 outline-offset-2 outline-dashed outline-accent" : ""} ${isDragging ? "z-10 opacity-70" : ""}`}
    >
      {isDropTarget && <span aria-hidden="true" className="absolute -top-2.5 right-0 left-0 h-1 bg-accent" />}
      {dependsOn && (
        <span className="fw-carbon label-mono pointer-events-none absolute -top-3 right-2 z-[1] max-w-[70%] truncate px-1.5 py-1">
          Shown if “{dependsOn}” matches
        </span>
      )}
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Move ${name}. Position ${index + 1}`}
        className="flex w-7 shrink-0 cursor-grab touch-none items-center justify-center text-muted hover:bg-band hover:text-ink focus-visible:outline-2 focus-visible:-outline-offset-2 active:cursor-grabbing"
      >
        <span aria-hidden="true">⋮⋮</span>
      </button>
      <button
        type="button"
        onClick={() => select(field.id)}
        aria-pressed={selected}
        className="min-w-0 flex-1 py-2.5 pr-2 pl-1 text-left focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <span className="label-mono flex gap-2 text-muted">
          {number !== null && <span className="text-accent">{String(number).padStart(2, "0")}</span>}
          <span aria-hidden="true">{codeFor(field.type)} ·</span>
          <span>{typeName(field.type)}</span>
        </span>
        <span className="mt-1.5 flex items-baseline gap-1.5">
          <span className={`truncate ${heading ? "text-lg font-extrabold text-accent-dark" : "font-medium"}`}>{name}</span>
          {field.required && <span className="font-bold text-danger" aria-label="required">*</span>}
        </span>
        {!heading && <span aria-hidden="true" className="mt-2 block h-px bg-line" />}
        {problem && <span className="label-mono mt-2 block normal-case tracking-normal text-danger">⚠ {problem}</span>}
      </button>
      <div className="flex items-center gap-1 pr-2 opacity-100 sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        <IconButton label={`Duplicate ${name}`} onClick={() => dispatch({ type: "duplicateField", id: field.id })}>⧉</IconButton>
        <IconButton label={`Delete ${name}`} onClick={() => dispatch({ type: "removeField", id: field.id })}>✕</IconButton>
      </div>
    </li>
  );
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-8 place-items-center text-muted hover:bg-band hover:text-ink focus-visible:outline-2"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

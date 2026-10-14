import { parseFormSchema, type Field } from "@formwise/renderer";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useBuilder } from "../state/store";
import { fieldName, glyphFor, typeName } from "./field-meta";

export const CANVAS_ID = "canvas";

export function Canvas({ dropTargetId }: { dropTargetId: string | null }) {
  const form = useBuilder((s) => s.form);
  const { setNodeRef, isOver } = useDroppable({ id: CANVAS_ID });
  const labels = new Map(form.fields.map((f) => [f.id, fieldName(f)]));
  const problems = problemsByIndex(form);

  return (
    <section aria-label="Form canvas" className="flex flex-col gap-3">
      <FormHeader />
      <div
        ref={setNodeRef}
        className={`flex min-h-48 flex-col gap-2 rounded-xl border-2 border-dashed p-2 transition-colors ${
          isOver || dropTargetId === CANVAS_ID ? "border-accent bg-accent-soft/40" : "border-transparent"
        }`}
      >
        <SortableContext items={form.fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
          <ol className="flex flex-col gap-2" aria-label="Questions">
            {form.fields.map((field, i) => (
              <SortableField
                key={field.id}
                field={field}
                index={i}
                dependsOn={field.showIf ? labels.get(field.showIf.fieldId) : undefined}
                isDropTarget={dropTargetId === field.id}
                problem={problems.get(i)}
              />
            ))}
          </ol>
        </SortableContext>
        {form.fields.length === 0 && (
          <p className="grid min-h-40 place-items-center text-center text-sm text-muted">
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
      className={`rounded-xl border bg-panel p-4 text-left focus-visible:outline-2 focus-visible:outline-accent ${active ? "border-accent ring-1 ring-accent" : "border-line"}`}
    >
      <span className="block text-lg font-semibold">{form.title || "Untitled form"}</span>
      <span className="block text-sm text-muted">{form.description || "Form settings: click to edit the title and description"}</span>
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

function SortableField(props: { field: Field; index: number; dependsOn?: string; isDropTarget: boolean; problem?: string }) {
  const { field, index, dependsOn, isDropTarget, problem } = props;
  const selectedId = useBuilder((s) => s.selectedId);
  const select = useBuilder((s) => s.select);
  const dispatch = useBuilder((s) => s.dispatch);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
    data: { from: "canvas" },
  });
  const selected = selectedId === field.id;
  const name = fieldName(field);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`group relative flex items-stretch rounded-xl border bg-panel ${
        selected ? "border-accent ring-1 ring-accent" : "border-line"
      } ${isDragging ? "z-10 opacity-60 shadow-lg" : ""}`}
    >
      {isDropTarget && <span aria-hidden="true" className="absolute -top-1.5 right-2 left-2 h-0.5 rounded bg-accent" />}
      <button
        ref={setActivatorNodeRef}
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Move ${name}. Position ${index + 1}`}
        className="flex w-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-l-xl text-muted hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent active:cursor-grabbing"
      >
        <span aria-hidden="true">⋮⋮</span>
      </button>
      <button
        type="button"
        onClick={() => select(field.id)}
        aria-pressed={selected}
        className="min-w-0 flex-1 px-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="flex items-center gap-2">
          <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded bg-accent-soft text-xs font-semibold text-accent">
            {glyphFor(field.type)}
          </span>
          <span className={`truncate ${field.type === "heading" ? "font-semibold" : ""}`}>{name}</span>
          {field.required && <span className="text-danger" aria-label="required">*</span>}
        </span>
        <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 pl-8 text-xs text-muted">
          <span>{typeName(field.type)}</span>
          {dependsOn && <span>Shown if “{dependsOn}” matches</span>}
          {problem && <span className="font-medium text-danger">⚠ {problem}</span>}
        </span>
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
      className="grid size-8 place-items-center rounded-md text-muted hover:bg-accent-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-accent"
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
}

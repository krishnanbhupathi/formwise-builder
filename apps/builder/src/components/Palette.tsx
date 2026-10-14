import type { FieldType } from "@formwise/renderer";
import { useDraggable } from "@dnd-kit/core";
import type { PointerEventHandler } from "react";
import { typeName, PALETTE } from "./field-meta";

export type PaletteDragData = { from: "palette"; fieldType: FieldType };

/**
 * Field types. Drag one onto the canvas, or click it (or press Enter) to add
 * it after the selected question. Clicking is the keyboard/touch-friendly path.
 */
export function Palette({ onAdd }: { onAdd: (type: FieldType) => void }) {
  return (
    <nav aria-label="Field types" className="flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Add a field</h2>
      <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {PALETTE.map((item) => (
          <li key={item.type} className="shrink-0">
            <PaletteItem type={item.type} glyph={item.glyph} hint={item.hint} onAdd={onAdd} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function PaletteItem({ type, glyph, hint, onAdd }: { type: FieldType; glyph: string; hint: string; onAdd: (type: FieldType) => void }) {
  const data: PaletteDragData = { from: "palette", fieldType: type };
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: `palette:${type}`, data });

  return (
    <button
      ref={setNodeRef}
      type="button"
      // Pointer drag only: keyboard users press Enter to add, then sort on the canvas.
      onPointerDown={listeners?.onPointerDown as PointerEventHandler | undefined}
      onClick={() => onAdd(type)}
      title={hint}
      aria-label={`Add ${typeName(type)}`}
      className={`flex w-full touch-none items-center gap-2.5 rounded-lg border border-line bg-panel px-3 py-2 text-left text-sm hover:border-accent focus-visible:outline-2 focus-visible:outline-accent ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <span aria-hidden="true" className="grid size-6 place-items-center rounded bg-accent-soft text-xs font-semibold text-accent">
        {glyph}
      </span>
      <span className="whitespace-nowrap">{typeName(type)}</span>
    </button>
  );
}

export function PaletteGhost({ type }: { type: FieldType }) {
  return (
    <div className="rounded-lg border border-accent bg-panel px-3 py-2 text-sm shadow-lg">
      {typeName(type)}
    </div>
  );
}

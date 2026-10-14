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
      <h2 className="label-mono text-muted">Add a field</h2>
      <ul className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:gap-0 lg:overflow-visible lg:border-b lg:border-line">
        {PALETTE.map((item) => (
          <li key={item.type} className="shrink-0">
            <PaletteItem type={item.type} code={item.code} hint={item.hint} onAdd={onAdd} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function PaletteItem({ type, code, hint, onAdd }: { type: FieldType; code: string; hint: string; onAdd: (type: FieldType) => void }) {
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
      className={`flex w-full cursor-grab touch-none items-center gap-3 border border-line bg-panel px-3 py-2 text-left text-sm font-medium hover:bg-band focus-visible:outline-2 focus-visible:-outline-offset-2 lg:border-0 lg:border-t ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <span aria-hidden="true" className="label-mono w-7 text-accent">
        {code}
      </span>
      <span className="whitespace-nowrap">{typeName(type)}</span>
    </button>
  );
}

export function PaletteGhost({ type }: { type: FieldType }) {
  return (
    <div className="flex items-center gap-3 border-[1.5px] border-ink bg-panel px-3 py-2 text-sm font-medium shadow-[4px_4px_0_var(--ledger)]">
      <span aria-hidden="true" className="label-mono text-accent">{PALETTE.find((p) => p.type === type)?.code}</span>
      {typeName(type)}
    </div>
  );
}

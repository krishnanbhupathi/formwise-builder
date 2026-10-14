import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import type { FieldType } from "@formwise/renderer";
import { useState } from "react";
import { Canvas, CANVAS_ID } from "./components/Canvas";
import { fieldName, typeName } from "./components/field-meta";
import { Palette, PaletteGhost, type PaletteDragData } from "./components/Palette";
import { PropertiesPanel } from "./components/PropertiesPanel";
import { Preview } from "./components/Preview";
import { UndoRedo } from "./components/UndoRedo";
import { useBuilder } from "./state/store";

type Tab = "properties" | "preview";

export function App() {
  const dispatch = useBuilder((s) => s.dispatch);
  const notice = useBuilder((s) => s.notice);
  const dismissNotice = useBuilder((s) => s.dismissNotice);
  const [tab, setTab] = useState<Tab>("properties");
  const [dragging, setDragging] = useState<FieldType | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const sensors = useSensors(
    // A small distance lets a plain click still select/add without starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const addField = (fieldType: FieldType) => {
    const { form, selectedId } = useBuilder.getState();
    const at = form.fields.findIndex((f) => f.id === selectedId);
    dispatch({ type: "addField", fieldType, index: at === -1 ? form.fields.length : at + 1 });
    setTab("properties");
  };

  const onDragStart = ({ active }: DragStartEvent) => {
    const data = active.data.current as PaletteDragData | undefined;
    if (data?.from === "palette") setDragging(data.fieldType);
  };
  const onDragOver = ({ over }: DragOverEvent) => setDropTargetId(dragging && over ? String(over.id) : null);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    setDropTargetId(null);
    if (!over) return;
    const fields = useBuilder.getState().form.fields;
    const overIndex = fields.findIndex((f) => f.id === over.id);
    const data = active.data.current as PaletteDragData | { from: "canvas" } | undefined;

    if (data?.from === "palette") {
      dispatch({ type: "addField", fieldType: data.fieldType, index: overIndex === -1 ? fields.length : overIndex });
      setTab("properties");
    } else if (overIndex !== -1 && active.id !== over.id) {
      dispatch({ type: "moveField", id: String(active.id), toIndex: overIndex });
    }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-3 border-b border-line bg-panel px-4 py-3">
        <img src="/favicon.svg" alt="" className="size-7" />
        <h1 className="text-base font-semibold">Formwise</h1>
        <span className="hidden text-sm text-muted sm:inline">Drag-and-drop form builder</span>
        <div className="ml-auto">
          <UndoRedo />
        </div>
      </header>

      {notice && (
        <div role="status" className="flex items-start justify-between gap-3 border-b border-line bg-accent-soft px-4 py-2 text-sm">
          <span>{notice}</span>
          <button type="button" onClick={dismissNotice} className="shrink-0 font-medium text-accent">Dismiss</button>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => { setDragging(null); setDropTargetId(null); }}
        accessibility={{ announcements: useAnnouncements() }}
      >
        <main className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-1 gap-6 p-4 lg:grid-cols-[12rem_minmax(0,1fr)_24rem]">
          <aside className="lg:sticky lg:top-4 lg:self-start">
            <Palette onAdd={addField} />
          </aside>
          <Canvas dropTargetId={dropTargetId} />
          <aside aria-label="Inspector" className="flex flex-col gap-3 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:self-start lg:overflow-y-auto">
            <div role="tablist" aria-label="Inspector" className="grid grid-cols-2 rounded-lg border border-line bg-panel p-1">
              {(["properties", "preview"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  type="button"
                  aria-selected={tab === t}
                  aria-controls={`panel-${t}`}
                  id={`tab-${t}`}
                  onClick={() => setTab(t)}
                  className={`rounded-md py-1.5 text-sm font-medium ${tab === t ? "bg-accent text-white dark:text-slate-950" : "text-muted hover:text-ink"}`}
                >
                  {t === "properties" ? "Properties" : "Preview"}
                </button>
              ))}
            </div>
            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="rounded-xl border border-line bg-panel p-4">
              {tab === "properties" ? <PropertiesPanel /> : <Preview />}
            </div>
          </aside>
        </main>
        <DragOverlay dropAnimation={null}>{dragging ? <PaletteGhost type={dragging} /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}

/** Screen-reader messages that use question names instead of internal ids. */
function useAnnouncements(): Announcements {
  const fields = useBuilder((s) => s.form.fields);
  const nameOf = (id: string | number) => {
    const f = fields.find((x) => x.id === id);
    if (f) return `“${fieldName(f)}”`;
    if (id === CANVAS_ID) return "the end of the form";
    return String(id).startsWith("palette:") ? `new ${typeName(String(id).slice(8) as FieldType)} field` : String(id);
  };
  const position = (id: string | number) => fields.findIndex((f) => f.id === id) + 1;
  return {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}.`,
    onDragOver: ({ active, over }) => {
      if (!over) return `${nameOf(active.id)} is not over a drop area.`;
      if (over.id === active.id) return `${nameOf(active.id)} is at position ${position(over.id)}.`;
      return `${nameOf(active.id)} is over ${nameOf(over.id)}, position ${position(over.id) || fields.length + 1}.`;
    },
    onDragEnd: ({ active, over }) => (over ? `Dropped ${nameOf(active.id)} at position ${position(over.id) || fields.length}.` : `Dropped ${nameOf(active.id)}; nothing changed.`),
    onDragCancel: ({ active }) => `Cancelled moving ${nameOf(active.id)}.`,
  };
}

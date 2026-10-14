import { useEffect } from "react";
import { useBuilder } from "../state/store";

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl+";

/**
 * Undo/redo buttons plus Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z and Ctrl+Y. Shortcuts
 * are ignored inside the preview form, where they should undo the text being
 * typed rather than the form design.
 */
export function UndoRedo() {
  const undo = useBuilder((s) => s.undo);
  const redo = useBuilder((s) => s.redo);
  const canUndo = useBuilder((s) => s.canUndo);
  const canRedo = useBuilder((s) => s.canRedo);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      if (e.target instanceof Element && e.target.closest(".fw-form, [contenteditable='true']")) return;
      const key = e.key.toLowerCase();
      if (key === "z" && !e.shiftKey) undo();
      else if ((key === "z" && e.shiftKey) || (key === "y" && !isMac)) redo();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo]);

  const cls =
    "grid h-9 min-w-9 place-items-center rounded-md px-2 text-sm text-muted hover:bg-accent-soft hover:text-ink focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-35 disabled:hover:bg-transparent";
  return (
    <div className="flex items-center gap-1" role="group" aria-label="History">
      <button type="button" className={cls} onClick={undo} disabled={!canUndo} aria-label="Undo" title={`Undo (${MOD}Z)`} aria-keyshortcuts="Control+Z Meta+Z">
        <span aria-hidden="true">↶</span>
      </button>
      <button type="button" className={cls} onClick={redo} disabled={!canRedo} aria-label="Redo" title={`Redo (${MOD}${isMac ? "⇧Z" : "Y"})`} aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y">
        <span aria-hidden="true">↷</span>
      </button>
    </div>
  );
}

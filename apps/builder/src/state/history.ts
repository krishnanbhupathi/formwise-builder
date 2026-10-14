/**
 * Snapshot undo/redo. Forms are immutable (Immer shares unchanged parts), so
 * each step costs little more than the changed field, and restoring a
 * snapshot can't drift the way hand-written inverse commands can.
 */
export type History<T> = {
  past: T[];
  present: T;
  future: T[];
  /** Key and time of the last recorded change, for merging bursts of typing. */
  lastKey: string | null;
  lastAt: number;
};

export const HISTORY_LIMIT = 100;
/** Changes with the same key less than this far apart become one undo step. */
export const COALESCE_MS = 1000;

export const initHistory = <T>(present: T): History<T> => ({ past: [], present, future: [], lastKey: null, lastAt: 0 });

export function record<T>(h: History<T>, next: T, { key = null, now }: { key?: string | null; now: number }): History<T> {
  const merge = key !== null && key === h.lastKey && now - h.lastAt < COALESCE_MS && h.past.length > 0;
  return {
    past: merge ? h.past : [...h.past, h.present].slice(-HISTORY_LIMIT),
    present: next,
    future: [],
    lastKey: key,
    lastAt: now,
  };
}

export function undo<T>(h: History<T>): History<T> {
  if (h.past.length === 0) return h;
  return { past: h.past.slice(0, -1), present: h.past.at(-1) as T, future: [h.present, ...h.future], lastKey: null, lastAt: 0 };
}

export function redo<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h;
  const [next, ...rest] = h.future;
  return { past: [...h.past, h.present], present: next as T, future: rest, lastKey: null, lastAt: 0 };
}

export const canUndo = (h: History<unknown>) => h.past.length > 0;
export const canRedo = (h: History<unknown>) => h.future.length > 0;

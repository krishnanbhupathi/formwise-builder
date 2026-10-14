import { isInputField } from "@formwise/renderer";
import { useRef, useState } from "react";
import { api } from "../lib/api";
import { useBuilder } from "../state/store";
import { Button } from "./Shell";

const MAX = 1000;
const EXAMPLES = [
  "Intake form for a private maths tutor: student name, parent email, school year, exam board, topics they find hard, consent to be contacted.",
  "Event RSVP: name, email, number of guests, dietary needs if attending, and whether they need parking.",
  "Bug report: what happened, steps to reproduce, browser, severity (low/medium/high), and a screenshot.",
];

/** "Describe your form": Claude drafts it, and it replaces the canvas in one undoable step. */
export function DescribeButton() {
  const ref = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setError(null);
    try {
      const { form: current, dispatch, notify } = useBuilder.getState();
      const { form } = await api.generateForm(text.trim(), current.id);
      dispatch({ type: "replaceForm", form: { ...form, id: current.id } });
      const questions = form.fields.filter(isInputField).length;
      notify(`Generated “${form.title}” with ${questions} questions. Undo (Ctrl/⌘+Z) to get your previous form back.`);
      ref.current?.close();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't generate the form");
    } finally {
      setBusy(false);
    }
  }

  const tooShort = text.trim().length < 10;
  return (
    <>
      <Button onClick={() => ref.current?.showModal()}>
        Describe it
      </Button>
      <dialog ref={ref} aria-labelledby="describe-title" className="m-auto w-[min(36rem,calc(100vw-2rem))] border-2 border-ink bg-panel p-0 text-ink shadow-[6px_6px_0_var(--ink)] backdrop:bg-ink/45">
        <form
          className="flex flex-col gap-4 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!tooShort && !busy) void generate();
          }}
        >
          <div>
            <h2 id="describe-title" className="text-2xl font-black tracking-tight text-accent-dark">Describe your form</h2>
            <p className="text-sm text-muted">Claude drafts the questions, types and conditions. It replaces the current form; undo brings it back.</p>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="label-mono text-muted">What should the form collect?</span>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={MAX}
              rows={5}
              autoFocus
              placeholder="e.g. A booking enquiry form for a wedding photographer…"
              className="border-[1.5px] border-ink bg-panel px-3 py-2 text-sm"
            />
          </label>
          <div className="flex items-center justify-between font-mono text-xs text-muted">
            <span>{text.length}/{MAX}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="label-mono text-muted">Try an example</span>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button key={ex} type="button" onClick={() => setText(ex)} className="border border-ink bg-panel px-2.5 py-1 text-left text-xs font-medium hover:bg-canary">
                  {ex.split(":")[0]}
                </button>
              ))}
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button onClick={() => ref.current?.close()} disabled={busy}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={busy || tooShort}>{busy ? "Generating…" : "Generate form"}</Button>
          </div>
        </form>
      </dialog>
    </>
  );
}

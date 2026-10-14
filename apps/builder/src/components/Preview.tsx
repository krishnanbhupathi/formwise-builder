import { FormRenderer, type FieldValue } from "@formwise/renderer";
import { useState } from "react";
import { useBuilder } from "../state/store";

/** The real renderer, fed the live schema. Submitting shows the data it would send. */
export function Preview() {
  const form = useBuilder((s) => s.form);
  const [submitted, setSubmitted] = useState<Record<string, FieldValue> | null>(null);
  const [run, setRun] = useState(0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="label-mono text-ink">Live preview</h2>
        <button type="button" onClick={() => { setRun((r) => r + 1); setSubmitted(null); }} className="px-1 py-1 text-sm font-semibold text-accent underline-offset-4 hover:underline">
          Reset answers
        </button>
      </div>
      <div className="fw-paper border border-dashed border-ink bg-panel p-4">
        <FormRenderer key={run} form={form} onSubmit={setSubmitted} submitLabel="Test submit" />
      </div>
      {submitted && (
        <div role="status" className="flex flex-col gap-2">
          <h3 className="label-mono text-ink">Submitted data</h3>
          <pre className="fw-carbon overflow-x-auto p-3 font-mono text-xs">{JSON.stringify(submitted, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

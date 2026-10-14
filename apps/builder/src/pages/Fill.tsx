import { FormRenderer, type FormSchema, type FormValues } from "@formwise/renderer";
import { useEffect, useRef, useState } from "react";
import { Button, Centered } from "../components/Shell";
import { api, ApiError } from "../lib/api";

/** The public share-link page: the published form, nothing else from the builder. */
export function Fill({ id }: { id: string }) {
  const [state, setState] = useState<{ form?: FormSchema; version?: number; error?: string }>({});
  const [done, setDone] = useState(false);
  const [run, setRun] = useState(0);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const honeypot = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.publicForm(id).then(
      ({ form, version }) => {
        setState({ form, version });
        document.title = form.title || "Form";
      },
      (e: unknown) => setState({ error: e instanceof ApiError && e.status === 404 ? "This form isn't available. It may not be published yet." : "Couldn't load the form. Please try again." }),
    );
  }, [id]);

  async function onSubmit(values: FormValues) {
    setSubmitError(null);
    try {
      await api.submit(id, state.version!, values, honeypot.current?.value ?? "");
      setDone(true);
      window.scrollTo(0, 0);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422 && e.body.errors) {
        setSubmitError(`Some answers need attention: ${Object.values(e.body.errors as Record<string, string>).join("; ")}`);
      } else setSubmitError(e instanceof Error ? e.message : "Couldn't send your answers");
    }
  }

  return (
    <div className="min-h-dvh bg-surface">
      <Centered>
        {state.error && <p className="rounded-xl border border-line bg-panel p-6">{state.error}</p>}
        {!state.form && !state.error && <p className="text-muted">Loading…</p>}
        {state.form && done && (
          <div role="status" className="flex flex-col items-start gap-3 rounded-xl border border-line bg-panel p-6">
            <h1 className="text-xl font-semibold">Thanks, your answers were sent.</h1>
            <Button onClick={() => { setDone(false); setRun((r) => r + 1); }}>Submit another response</Button>
          </div>
        )}
        {state.form && !done && (
          <div className="rounded-xl border border-line bg-panel p-5 sm:p-8">
            <FormRenderer key={run} form={state.form} onSubmit={onSubmit}>
              {/* Honeypot: hidden from people and assistive tech; bots that fill every input reveal themselves. */}
              <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
                <label>
                  Website
                  <input ref={honeypot} type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
                </label>
              </div>
              {submitError && <p role="alert" className="text-sm text-danger">{submitError}</p>}
            </FormRenderer>
          </div>
        )}
        <p className="text-center text-xs text-muted">Made with Formwise</p>
      </Centered>
    </div>
  );
}

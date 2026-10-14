import { FormRenderer, type FormSchema, type FormValues } from "@formwise/renderer";
import { useEffect, useRef, useState } from "react";
import { Button, Centered, Logo } from "../components/Shell";
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
    <div className="fw-paper min-h-dvh bg-surface">
      <Centered>
        {state.error && <p className="border-[1.5px] border-ink bg-panel p-6">{state.error}</p>}
        {!state.form && !state.error && <p className="text-muted">Loading…</p>}
        {state.form && done && (
          <div role="status" className="fw-sheet flex flex-col items-start gap-4 py-10">
            <span className="fw-stamp px-3 py-1.5 text-sm">Received</span>
            <h1 className="text-[1.75rem] leading-tight font-black tracking-[-0.025em] text-accent-dark">Thanks, your answers were sent.</h1>
            <Button onClick={() => { setDone(false); setRun((r) => r + 1); }}>Submit another response</Button>
          </div>
        )}
        {state.form && !done && (
          <div className="fw-sheet py-8">
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
        <a href="/" className="label-mono flex items-center justify-center gap-2 text-muted hover:text-ink">
          <Logo className="size-4 text-accent-dark" />
          Made with Formwise
        </a>
      </Centered>
    </div>
  );
}

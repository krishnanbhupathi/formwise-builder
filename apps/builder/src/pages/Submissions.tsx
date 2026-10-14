import type { FormSchema } from "@formwise/renderer";
import { useEffect, useMemo, useState } from "react";
import { buttonLook } from "../components/button-look";
import { Button, Shell } from "../components/Shell";
import { api, type Submission, type SubmissionPage } from "../lib/api";
import { formatValue, submissionColumns, toCsv } from "../lib/csv";
import { linkProps } from "../lib/router";
import { useEditToken, useOwnedForm } from "../lib/use-owned-form";

const when = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function Submissions({ id }: { id: string }) {
  const token = useEditToken(id);
  const { form, error } = useOwnedForm(id, token);
  const [rows, setRows] = useState<Submission[]>([]);
  const [versions, setVersions] = useState<Record<string, FormSchema>>({});
  const [total, setTotal] = useState<number | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const apply = (page: SubmissionPage, append: boolean) => {
    setRows((r) => (append ? [...r, ...page.submissions] : page.submissions));
    setVersions((v) => ({ ...v, ...page.versions }));
    setTotal(page.total);
    setNext(page.nextBefore);
  };
  const fail = (e: unknown) => setLoadError(e instanceof Error ? e.message : "Couldn't load submissions");

  useEffect(() => {
    if (!form || !token) return;
    document.title = `Submissions · ${form.form.title || "Untitled form"}`;
    let cancelled = false;
    api.submissions(id, token).then((page) => !cancelled && apply(page, false), (e: unknown) => !cancelled && fail(e));
    return () => {
      cancelled = true;
    };
  }, [form, id, token]);

  async function loadMore() {
    if (!token || !next) return;
    setBusy(true);
    try {
      apply(await api.submissions(id, token, next), true);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }

  const columns = useMemo(() => submissionColumns(versions), [versions]);

  /** Loads every remaining page, then downloads a CSV built in the browser (the token never goes in a URL). */
  async function exportCsv() {
    let all = rows;
    let allVersions = versions;
    let cursor = next;
    setBusy(true);
    try {
      while (cursor) {
        const page = await api.submissions(id, token!, cursor);
        all = [...all, ...page.submissions];
        allVersions = { ...allVersions, ...page.versions };
        cursor = page.nextBefore;
      }
      setRows(all);
      setVersions(allVersions);
      setNext(null);
      const blob = new Blob([toCsv(submissionColumns(allVersions), all)], { type: "text/csv;charset=utf-8" });
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `${(form?.form.title || "form").replace(/[^\w-]+/g, "-")}-submissions.csv` });
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  const failure = error ?? loadError;
  return (
    <Shell
      docLabel={<>Form <span className="normal-case">{id}</span> · submissions</>}
      actions={
        <>
          <a {...linkProps(`/edit/${id}`)} className={buttonLook.secondary}>
            Back to editor
          </a>
          <Button variant="primary" onClick={exportCsv} disabled={busy || !rows.length}>Export CSV</Button>
        </>
      }
    >
      <main className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 p-4">
        <div>
          <h1 className="text-[2.25rem] leading-tight font-black tracking-[-0.03em] text-accent-dark">{form?.form.title || "Submissions"}</h1>
          {total !== null && <p className="label-mono text-muted">{total === 1 ? "1 submission" : `${total} submissions`}</p>}
        </div>
        {failure && <p role="alert" className="text-danger">{failure}</p>}
        {total === 0 && (
          <p className="border-[1.5px] border-dashed border-ink bg-panel p-6 text-muted">
            No submissions yet. {form?.publishedVersion ? <>Share the public link: <a className="text-accent underline" href={`/f/${id}`}>{location.origin}/f/{id}</a></> : "Publish the form, then share its public link."}
          </p>
        )}
        {rows.length > 0 && (
          <div className="overflow-x-auto border-[1.5px] border-ink bg-panel">
            <table className="w-full min-w-max text-left text-sm">
              <caption className="sr-only">Submissions, newest first</caption>
              <thead className="border-b-2 border-ink bg-band">
                <tr>
                  <th scope="col" className="label-mono px-3 py-2.5 text-ink">Submitted</th>
                  {columns.map((c) => (
                    <th key={c.id} scope="col" className="label-mono max-w-64 px-3 py-2.5 text-ink">{c.label}</th>
                  ))}
                  <th scope="col" className="label-mono px-3 py-2.5 text-ink">Version</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line align-top last:border-0 even:bg-band/50">
                    <td className="px-3 py-2 font-mono text-xs whitespace-nowrap text-muted">{when.format(new Date(r.createdAt))}</td>
                    {columns.map((c) => (
                      <td key={c.id} className="max-w-64 px-3 py-2 break-words whitespace-pre-wrap">{formatValue(r.data[c.id])}</td>
                    ))}
                    <td className="px-3 py-2 font-mono text-xs text-muted">v{r.version}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {next && <Button onClick={() => void loadMore()} disabled={busy} className="self-center">Load more</Button>}
      </main>
    </Shell>
  );
}

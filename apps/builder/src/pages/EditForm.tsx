import { useEffect, useRef, useState } from "react";
import { Button, Centered, Shell } from "../components/Shell";
import { UndoRedo } from "../components/UndoRedo";
import type { OwnedForm } from "../lib/api";
import { useAutosave, type SaveStatus } from "../lib/autosave";
import { useEditToken, useOwnedForm } from "../lib/use-owned-form";
import { linkProps, navigate } from "../lib/router";
import { useBuilder } from "../state/store";
import { Builder } from "./Builder";

export function EditForm({ id }: { id: string }) {
  const token = useEditToken(id);
  const { form, error } = useOwnedForm(id, token);

  if (error) {
    return (
      <Shell>
        <Centered>
          <h1 className="text-xl font-semibold">Can't open this form</h1>
          <p className="text-muted">{error}</p>
          <p><a {...linkProps("/forms")} className="text-accent underline">See your forms</a></p>
        </Centered>
      </Shell>
    );
  }
  if (!form || !token) return <Shell><Centered><p className="text-muted">Loading…</p></Centered></Shell>;
  return <Editor id={id} token={token} initial={form} />;
}

function Editor({ id, token, initial }: { id: string; token: string; initial: OwnedForm }) {
  useEffect(() => {
    useBuilder.getState().load(initial.form);
  }, [initial]);
  // Render the workspace once the store holds this form (not the previous page's).
  const loaded = useBuilder((s) => s.form.id === initial.form.id);
  const title = useBuilder((s) => s.form.title);
  useEffect(() => {
    document.title = `${title || "Untitled form"} · Formwise`;
  }, [title]);

  const { status, error, server, saver } = useAutosave(id, token, initial);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const shareRef = useRef<HTMLDialogElement>(null);

  const upToDate = server.publishedRevision === server.revision && status === "saved";
  async function onPublish() {
    setPublishing(true);
    setPublishError(null);
    try {
      await saver.publish();
      shareRef.current?.showModal();
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Couldn't publish");
    } finally {
      setPublishing(false);
    }
  }

  if (!loaded) return null;
  return (
    <Shell
      actions={
        <>
          <SaveIndicator status={status} error={error} onRetry={() => void saver.save()} />
          <UndoRedo />
          <a
            href={`/edit/${id}/submissions`}
            onClick={async (e) => {
              if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              // Save first so the submissions page (and its CSV) sees the latest title and questions.
              await saver.save();
              navigate(`/edit/${id}/submissions`);
            }}
            className="inline-flex h-9 items-center rounded-lg border border-line bg-panel px-3 text-sm font-medium hover:border-accent"
          >
            Submissions
          </a>
          <Button onClick={() => shareRef.current?.showModal()}>Share</Button>
          <Button variant="primary" onClick={onPublish} disabled={publishing || upToDate || status === "conflict"} title={upToDate ? "The live form matches this draft" : undefined}>
            {publishing ? "Publishing…" : upToDate ? "Published" : server.publishedVersion ? "Publish changes" : "Publish"}
          </Button>
        </>
      }
    >
      {publishError && <p role="alert" className="border-b border-line bg-accent-soft px-4 py-2 text-sm text-danger">{publishError}</p>}
      <Builder />
      <ShareDialog ref={shareRef} id={id} token={token} published={server.publishedVersion !== null} />
    </Shell>
  );
}

function SaveIndicator({ status, error, onRetry }: { status: SaveStatus; error: string | null; onRetry: () => void }) {
  const text = { saved: "All changes saved", pending: "Unsaved changes", saving: "Saving…", error: "Couldn't save", conflict: "Edited elsewhere" }[status];
  return (
    <span role="status" className={`flex items-center gap-2 text-sm ${status === "error" || status === "conflict" ? "text-danger" : "text-muted"}`} title={error ?? undefined}>
      {text}
      {status === "error" && <button type="button" onClick={onRetry} className="font-medium text-accent underline">Retry</button>}
      {status === "conflict" && <button type="button" onClick={() => location.reload()} className="font-medium text-accent underline">Reload</button>}
    </span>
  );
}

function ShareDialog({ ref, id, token, published }: { ref: React.Ref<HTMLDialogElement>; id: string; token: string; published: boolean }) {
  const publicUrl = `${location.origin}/f/${id}`;
  const editUrl = `${location.origin}/edit/${id}#${token}`;
  return (
    <dialog ref={ref} aria-labelledby="share-title" className="m-auto w-[min(34rem,calc(100vw-2rem))] rounded-xl border border-line bg-panel p-0 text-ink backdrop:bg-black/40">
      <div className="flex flex-col gap-5 p-5">
        <h2 id="share-title" className="text-lg font-semibold">Share</h2>
        <LinkRow label="Public link" hint={published ? "Anyone with this link can fill in the form." : "Publish the form first; until then this link shows “not published”."} url={publicUrl} />
        <LinkRow label="Private edit link" hint="Anyone with this link can edit the form and read every submission. Keep it to yourself." url={editUrl} />
        <form method="dialog" className="flex justify-end">
          <Button type="submit">Done</Button>
        </form>
      </div>
    </dialog>
  );
}

function LinkRow({ label, hint, url }: { label: string; hint: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: the field is selectable as a fallback.
    }
  };
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex gap-2">
        <input readOnly value={url} aria-label={label} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm" />
        <Button onClick={copy} aria-label={`Copy ${label.toLowerCase()}`}>{copied ? "Copied" : "Copy"}</Button>
      </div>
      <span className="text-xs text-muted">{hint}</span>
    </div>
  );
}

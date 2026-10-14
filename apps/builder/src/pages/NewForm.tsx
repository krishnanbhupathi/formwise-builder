import { useEffect, useState } from "react";
import { Button, Shell } from "../components/Shell";
import { DescribeButton } from "../components/DescribeDialog";
import { UndoRedo } from "../components/UndoRedo";
import { api } from "../lib/api";
import { rememberForm } from "../lib/owned-forms";
import { navigate } from "../lib/router";
import { sampleForm } from "../sample";
import { useBuilder } from "../state/store";
import { Builder } from "./Builder";

/** An unsaved form (starts from the sample). Saving creates it on the server and opens its edit link. */
export function NewForm() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "New form · Formwise";
    useBuilder.getState().load(sampleForm);
  }, []);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const created = await api.createForm(useBuilder.getState().form);
      rememberForm({ id: created.id, token: created.editToken, title: created.form.title, updatedAt: created.updatedAt });
      // The token lives in the fragment: browsers never send it to the server or in Referer headers.
      navigate(`/edit/${created.id}#${created.editToken}`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save");
      setSaving(false);
    }
  }

  return (
    <Shell
      actions={
        <>
          {error && <span role="alert" className="text-sm text-danger">{error}</span>}
          <span className="text-sm text-muted">Not saved yet</span>
          <UndoRedo />
          <DescribeButton />
          <Button variant="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save form"}</Button>
        </>
      }
    >
      <Builder />
    </Shell>
  );
}

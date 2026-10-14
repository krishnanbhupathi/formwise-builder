import { useEffect, useState } from "react";
import { Centered, Shell } from "../components/Shell";
import { forgetForm, listOwnedForms } from "../lib/owned-forms";
import { linkProps } from "../lib/router";

const when = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/** Forms created or opened in this browser. There are no accounts: edit links are the keys. */
export function MyForms() {
  const [forms, setForms] = useState(listOwnedForms);
  useEffect(() => {
    document.title = "My forms · Formwise";
  }, []);

  return (
    <Shell>
      <Centered>
        <h1 className="text-xl font-semibold">My forms</h1>
        <p className="text-sm text-muted">Forms you created or opened in this browser. On another device, use the form's private edit link.</p>
        {forms.length === 0 ? (
          <p className="rounded-xl border border-line bg-panel p-6">
            Nothing here yet. <a {...linkProps("/")} className="text-accent underline">Build a form</a>
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-panel">
            {forms.map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                <a {...linkProps(`/edit/${f.id}`)} className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{f.title || "Untitled form"}</span>
                  <span className="text-xs text-muted">Edited {when.format(new Date(f.updatedAt))}</span>
                </a>
                <a {...linkProps(`/edit/${f.id}/submissions`)} className="text-sm text-accent">Submissions</a>
                <button
                  type="button"
                  className="text-sm text-muted hover:text-danger"
                  aria-label={`Remove ${f.title || "Untitled form"} from this list`}
                  onClick={() => {
                    forgetForm(f.id);
                    setForms(listOwnedForms());
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </Centered>
    </Shell>
  );
}

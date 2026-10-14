import { useEffect, useState } from "react";
import { api, ApiError, type OwnedForm } from "./api";
import { rememberForm, tokenFor } from "./owned-forms";

/** The edit token comes from the link's #fragment, or from this browser's list of forms. */
export function useEditToken(id: string): string | undefined {
  const [token] = useState(() => (location.hash.length > 1 ? decodeURIComponent(location.hash.slice(1)) : tokenFor(id)));
  return token;
}

/** Loads a form with its edit token. */
export function useOwnedForm(id: string, token: string | undefined): { form?: OwnedForm; error?: string } {
  const [state, setState] = useState<{ form?: OwnedForm; error?: string }>({});
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    api.getForm(id, token).then(
      (form) => {
        if (cancelled) return;
        rememberForm({ id, token, title: form.form.title, updatedAt: form.updatedAt });
        setState({ form });
      },
      (e: unknown) => {
        if (cancelled) return;
        setState({ error: e instanceof ApiError && e.status === 401 ? "This edit link isn't valid." : e instanceof Error ? e.message : "Couldn't load the form" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id, token]);
  return token ? state : { error: "This page needs the private edit link (it ends with #…)." };
}

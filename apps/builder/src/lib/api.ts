import type { FieldValue, FormSchema, FormValues } from "@formwise/renderer";

export class ApiError extends Error {
  readonly status: number;
  readonly body: Record<string, unknown>;
  constructor(status: number, message: string, body: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(method: string, path: string, { token, json }: { token?: string; json?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: json === undefined ? undefined : JSON.stringify(json),
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection.");
  }
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(res.status, typeof body.error === "string" ? body.error : `Request failed (${res.status})`, body);
  return body as T;
}

export type OwnedForm = {
  id: string;
  form: FormSchema;
  revision: number;
  publishedVersion: number | null;
  publishedRevision: number | null;
  updatedAt: string;
};
export type Submission = { id: string; version: number; data: Record<string, FieldValue>; createdAt: string };
export type SubmissionPage = { total: number; submissions: Submission[]; versions: Record<string, FormSchema>; nextBefore: string | null };

export const api = {
  createForm: (form: FormSchema) => request<OwnedForm & { editToken: string }>("POST", "/forms", { json: { form } }),
  getForm: (id: string, token: string) => request<OwnedForm>("GET", `/forms/${id}`, { token }),
  saveForm: (id: string, token: string, form: FormSchema, revision: number) =>
    request<OwnedForm>("PUT", `/forms/${id}`, { token, json: { form, revision } }),
  publish: (id: string, token: string, revision: number) => request<OwnedForm>("POST", `/forms/${id}/publish`, { token, json: { revision } }),
  submissions: (id: string, token: string, before?: string) =>
    request<SubmissionPage>("GET", `/forms/${id}/submissions${before ? `?before=${encodeURIComponent(before)}` : ""}`, { token }),
  publicForm: (id: string) => request<{ form: FormSchema; version: number }>("GET", `/public/forms/${id}`),
  submit: (id: string, version: number, values: FormValues, website: string) =>
    request<{ id: string }>("POST", `/public/forms/${id}/submissions`, { json: { version, values, website } }),
};

// @vitest-environment node
import type { FormSchema } from "@formwise/renderer/core";
import { eq } from "drizzle-orm";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, LIMITS } from "./app.js";
import type { Db } from "./db/index.js";
import { forms, submissions } from "./db/schema.js";
import { createTestDb, resetTestDb } from "./test/db.js";

// Each request runs real SQL in PGlite (WASM); give slow CI machines room.
vi.setConfig({ testTimeout: 20_000 });

let db: Db;
let clock: Date;
let ip: string;
let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  db = await createTestDb();
});

beforeEach(async () => {
  await resetTestDb(db);
  clock = new Date("2026-10-20T10:00:00Z");
  ip = "203.0.113.7";
  app = createApp({ db, now: () => clock, clientIp: () => ip });
});

const intake: FormSchema = {
  version: 1,
  id: "client-chosen",
  title: "Intake",
  fields: [
    { id: "name", type: "text", label: "Name", required: true },
    { id: "pro", type: "checkbox", label: "Existing client?", required: false },
    { id: "ref", type: "text", label: "Client number", required: true, showIf: { fieldId: "pro", equals: true } },
  ],
};

type Json = Record<string, any>;
async function call(method: string, path: string, { token, json, raw }: { token?: string; json?: unknown; raw?: string } = {}) {
  const res = await app.request(`/api${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: raw ?? (json === undefined ? undefined : JSON.stringify(json)),
  });
  return { status: res.status, body: (await res.json()) as Json };
}

async function createForm(form: FormSchema = intake) {
  const { status, body } = await call("POST", "/forms", { json: { form } });
  expect(status).toBe(201);
  return body as { id: string; editToken: string; revision: number };
}

async function publishedForm(form: FormSchema = intake) {
  const created = await createForm(form);
  expect((await call("POST", `/forms/${created.id}/publish`, { token: created.editToken, json: { revision: 1 } })).status).toBe(200);
  return created;
}

const submit = (id: string, values: Json, extra: Json = {}) => call("POST", `/public/forms/${id}/submissions`, { json: { version: 1, values, ...extra } });

it("reports health (including the database)", async () => {
  expect(await call("GET", "/health")).toEqual({ status: 200, body: { ok: true } });
});

describe("creating and owning a form", () => {
  it("creates a form with a server id and returns the edit token once", async () => {
    const { id, editToken } = await createForm();
    expect(id).toMatch(/^[2-9a-z]{10}$/);
    expect(editToken).toHaveLength(43);

    const row = await db.query.forms.findFirst({ where: eq(forms.id, id) });
    expect(row!.draft.id).toBe(id);
    expect(row!.editTokenHash).not.toContain(editToken);
    expect(row!.editTokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects invalid forms with every schema error", async () => {
    const bad = { ...intake, fields: [{ id: "a", type: "number", label: "A", min: 5, max: 1 }] };
    const { status, body } = await call("POST", "/forms", { json: { form: bad } });
    expect(status).toBe(422);
    expect(body.errors).toEqual(["fields.0.max: Maximum is below the minimum"]);
  });

  it("rejects bodies that aren't JSON, or are too large", async () => {
    expect((await call("POST", "/forms", { raw: "{nope" })).status).toBe(400);
    expect((await call("POST", "/forms", { raw: JSON.stringify({ form: intake, pad: "x".repeat(300_000) }) })).status).toBe(413);
  });

  it("requires the right edit token", async () => {
    const { id, editToken } = await createForm();
    expect((await call("GET", `/forms/${id}`)).status).toBe(401);
    expect((await call("GET", `/forms/${id}`, { token: "wrong" })).status).toBe(401);
    expect((await call("GET", `/forms/${id}`, { token: editToken.slice(0, -1) + "A" })).status).toBe(401);
    expect((await call("GET", `/forms/nosuchform`, { token: editToken })).status).toBe(404);
    expect((await call("GET", `/forms/${id}`, { token: editToken })).body.form.title).toBe("Intake");
  });

  it("limits how many forms one IP can create", async () => {
    for (let i = 0; i < LIMITS.createForm.limit; i++) await createForm();
    expect((await call("POST", "/forms", { json: { form: intake } })).status).toBe(429);
    ip = "198.51.100.1";
    await createForm();
  });
});

describe("saving drafts", () => {
  it("saves with optimistic locking: a stale revision gets 409", async () => {
    const { id, editToken: token } = await createForm();
    const first = await call("PUT", `/forms/${id}`, { token, json: { form: { ...intake, title: "Tab A" }, revision: 1 } });
    expect(first.body.revision).toBe(2);

    const stale = await call("PUT", `/forms/${id}`, { token, json: { form: { ...intake, title: "Tab B" }, revision: 1 } });
    expect(stale.status).toBe(409);
    expect(stale.body.revision).toBe(2);
    expect((await call("GET", `/forms/${id}`, { token })).body.form.title).toBe("Tab A");
  });

  it("validates saved drafts and keeps the server's id", async () => {
    const { id, editToken: token } = await createForm();
    expect((await call("PUT", `/forms/${id}`, { token, json: { form: { version: 99 }, revision: 1 } })).status).toBe(422);
    const ok = await call("PUT", `/forms/${id}`, { token, json: { form: { ...intake, id: "other" }, revision: 1 } });
    expect(ok.body.form.id).toBe(id);
  });
});

describe("publishing", () => {
  it("serves nothing publicly until published", async () => {
    const { id } = await createForm();
    expect((await call("GET", `/public/forms/${id}`)).status).toBe(404);
  });

  it("freezes the draft: later edits only go live on the next publish", async () => {
    const { id, editToken: token } = await publishedForm();
    await call("PUT", `/forms/${id}`, { token, json: { form: { ...intake, title: "Edited" }, revision: 1 } });
    expect((await call("GET", `/public/forms/${id}`)).body).toMatchObject({ version: 1, form: { title: "Intake" } });

    const second = await call("POST", `/forms/${id}/publish`, { token, json: { revision: 2 } });
    expect(second.body).toMatchObject({ publishedVersion: 2, publishedRevision: 2 });
    expect((await call("GET", `/public/forms/${id}`)).body).toMatchObject({ version: 2, form: { title: "Edited" } });
  });

  it("refuses to publish an unsaved revision or a form with no questions", async () => {
    const { id, editToken: token } = await createForm();
    expect((await call("POST", `/forms/${id}/publish`, { token, json: { revision: 7 } })).status).toBe(409);

    const empty = await createForm({ ...intake, fields: [{ id: "h", type: "heading", label: "Hi", required: false }] });
    const res = await call("POST", `/forms/${empty.id}/publish`, { token: empty.editToken, json: { revision: 1 } });
    expect(res).toEqual({ status: 422, body: { error: "Add at least one question before publishing" } });
  });
});

describe("public submissions", () => {
  it("validates on the server and stores normalised data without hidden answers", async () => {
    const { id } = await publishedForm();
    const res = await submit(id, { name: "  Sam ", pro: false, ref: "stale answer" });
    expect(res.status).toBe(201);
    const [row] = await db.select().from(submissions);
    expect(row).toMatchObject({ formId: id, version: 1, data: { name: "Sam", pro: false } });
  });

  it("returns field errors for invalid answers (and stores nothing)", async () => {
    const { id } = await publishedForm();
    const res = await submit(id, { name: "", pro: true });
    expect(res).toEqual({ status: 422, body: { error: "Some answers need attention", errors: { name: "This field is required", ref: "This field is required" } } });
    expect(await db.select().from(submissions)).toHaveLength(0);
  });

  it("validates against the version that was filled in, even after a re-publish", async () => {
    const { id, editToken: token } = await publishedForm();
    const v2 = { ...intake, fields: [...intake.fields, { id: "phone", type: "text" as const, label: "Phone", required: true }] };
    await call("PUT", `/forms/${id}`, { token, json: { form: v2, revision: 1 } });
    await call("POST", `/forms/${id}/publish`, { token, json: { revision: 2 } });

    expect((await submit(id, { name: "Sam" })).status).toBe(201); // v1 had no phone question
    expect((await submit(id, { name: "Sam" }, { version: 2 })).body.errors).toEqual({ phone: "This field is required" });
    expect((await submit(id, { name: "Sam" }, { version: 3 })).status).toBe(404);
  });

  it("silently drops honeypot submissions", async () => {
    const { id } = await publishedForm();
    expect((await submit(id, { name: "Bot" }, { website: "http://spam.example" })).status).toBe(201);
    expect(await db.select().from(submissions)).toHaveLength(0);
  });

  it("rate-limits each IP per form, resetting after the window", async () => {
    const { id } = await publishedForm();
    for (let i = 0; i < LIMITS.submissions.limit; i++) expect((await submit(id, { name: `S${i}` })).status).toBe(201);
    expect((await submit(id, { name: "One more" })).status).toBe(429);

    ip = "198.51.100.1";
    expect((await submit(id, { name: "Neighbour" })).status).toBe(201);

    ip = "203.0.113.7";
    clock = new Date(clock.getTime() + LIMITS.submissions.windowMs);
    expect((await submit(id, { name: "Later" })).status).toBe(201);
  });

  it("can't submit to an unpublished form", async () => {
    const { id } = await createForm();
    expect((await submit(id, { name: "Sam" })).status).toBe(404);
  });
});

describe("reading submissions", () => {
  it("lists newest first with the schemas needed to label them, paginated", async () => {
    const { id, editToken: token } = await publishedForm();
    const total = LIMITS.pageSize + 5;
    for (let i = 0; i < total; i++) {
      ip = `10.0.0.${i}`; // stay under the per-IP limit
      clock = new Date(clock.getTime() + 1000);
      await submit(id, { name: `S${i}` });
    }
    expect((await call("GET", `/forms/${id}/submissions`)).status).toBe(401);

    const first = await call("GET", `/forms/${id}/submissions`, { token });
    expect(first.body.total).toBe(total);
    expect(first.body.submissions).toHaveLength(LIMITS.pageSize);
    expect(first.body.submissions[0].data.name).toBe(`S${total - 1}`);
    expect(first.body.versions["1"].title).toBe("Intake");

    const second = await call("GET", `/forms/${id}/submissions?before=${encodeURIComponent(first.body.nextBefore)}`, { token });
    expect(second.body.submissions.map((s: Json) => s.data.name)).toEqual(["S4", "S3", "S2", "S1", "S0"]);
    expect(second.body.nextBefore).toBeNull();
  });
});

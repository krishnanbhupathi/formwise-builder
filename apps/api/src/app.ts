import { isInputField, parseFormSchema, validateSubmission, type FormSchema, type FormValues } from "@formwise/renderer/core";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { Hono, type Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { HTTPException } from "hono/http-exception";
import { customAlphabet } from "nanoid";
import { z } from "zod";
import type { Db } from "./db/index.js";
import { forms, formVersions, submissions } from "./db/schema.js";
import type { GenerateResult } from "./ai/generate.js";
import { allow } from "./lib/rate-limit.js";
import { hashIp, hashToken, newEditToken, tokenMatches } from "./lib/tokens.js";

/** Public form ids: short, URL-safe, no look-alike characters. */
const newFormId = customAlphabet("23456789abcdefghijkmnpqrstuvwxyz", 10);

export const LIMITS = {
  /** Submissions per IP per form. */
  submissions: { limit: 10, windowMs: 10 * 60_000 },
  /** New forms per IP. */
  createForm: { limit: 20, windowMs: 60 * 60_000 },
  pageSize: 50,
  /** AI generations per IP, and across everyone per day (cost guard). */
  aiPerIp: { limit: 10, windowMs: 60 * 60_000 },
  aiGlobal: { limit: 200, windowMs: 24 * 60 * 60_000 },
  aiDescriptionChars: 1000,
} as const;

export type AppDeps = {
  db: Db;
  now?: () => Date;
  /** The caller's IP. On Vercel, x-forwarded-for is set by the platform (client values are overwritten). */
  clientIp?: (c: Context) => string;
  /** Turns a description into a form; undefined when no AI key is configured. */
  generate?: (description: string, formId: string) => Promise<GenerateResult>;
};

const defaultClientIp = (c: Context) => c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";

/** Reads JSON and checks its shape; a malformed body is a 400 with a readable message. */
async function body<T extends z.ZodType>(c: Context, schema: T): Promise<z.infer<T>> {
  const raw = await c.req.json().catch(() => {
    throw new HTTPException(400, { message: "Body must be JSON" });
  });
  const result = schema.safeParse(raw);
  if (!result.success) throw new HTTPException(400, { message: result.error.issues[0]?.message ?? "Invalid request" });
  return result.data;
}

/** Validates an untrusted form and stamps it with the server's id. */
function acceptForm(input: unknown, id: string): FormSchema {
  const parsed = parseFormSchema(input);
  if (!parsed.ok) throw new HTTPException(422, { res: Response.json({ error: "Invalid form", errors: parsed.errors }, { status: 422 }) });
  return { ...parsed.form, id };
}

export function createApp({ db, now = () => new Date(), clientIp = defaultClientIp, generate }: AppDeps) {
  const app = new Hono().basePath("/api");

  app.use(bodyLimit({ maxSize: 256 * 1024, onError: (c) => c.json({ error: "Request too large" }, 413) }));
  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.res ?? c.json({ error: err.message }, err.status);
    console.error(err);
    return c.json({ error: "Something went wrong" }, 500);
  });
  app.notFound((c) => c.json({ error: "Not found" }, 404));

  /** Loads the form and checks the Bearer edit token. */
  async function ownedForm(c: Context) {
    const id = c.req.param("id")!;
    const token = c.req.header("authorization")?.match(/^Bearer (.+)$/)?.[1];
    const form = await db.query.forms.findFirst({ where: eq(forms.id, id) });
    if (!form) throw new HTTPException(404, { message: "Form not found" });
    if (!token || !tokenMatches(token, form.editTokenHash)) throw new HTTPException(401, { message: "This edit link isn't valid" });
    return form;
  }

  const summary = (f: typeof forms.$inferSelect) => ({
    id: f.id,
    form: f.draft,
    revision: f.revision,
    publishedVersion: f.publishedVersion,
    publishedRevision: f.publishedRevision,
    updatedAt: f.updatedAt.toISOString(),
  });

  app.get("/health", async (c) => {
    await db.execute(sql`select 1`);
    return c.json({ ok: true });
  });

  // --- Owner endpoints (Bearer edit token) ---------------------------------

  app.post("/forms", async (c) => {
    const { form: input } = await body(c, z.object({ form: z.unknown() }));
    if (!(await allow(db, `create:${hashIp(clientIp(c))}`, LIMITS.createForm.limit, LIMITS.createForm.windowMs, now()))) {
      return c.json({ error: "Too many new forms from this network. Try again later." }, 429);
    }
    const id = newFormId();
    const editToken = newEditToken();
    const [row] = await db
      .insert(forms)
      .values({ id, editTokenHash: hashToken(editToken), draft: acceptForm(input, id), createdAt: now(), updatedAt: now() })
      .returning();
    return c.json({ ...summary(row!), editToken }, 201);
  });

  app.get("/forms/:id", async (c) => c.json(summary(await ownedForm(c))));

  app.put("/forms/:id", async (c) => {
    const existing = await ownedForm(c);
    const { form: input, revision } = await body(c, z.object({ form: z.unknown(), revision: z.number().int().positive() }));
    const draft = acceptForm(input, existing.id);
    const [row] = await db
      .update(forms)
      .set({ draft, revision: sql`${forms.revision} + 1`, updatedAt: now() })
      .where(and(eq(forms.id, existing.id), eq(forms.revision, revision)))
      .returning();
    if (!row) return c.json({ error: "This form was changed somewhere else (another tab?). Reload to get the latest version.", revision: existing.revision }, 409);
    return c.json(summary(row));
  });

  app.post("/forms/:id/publish", async (c) => {
    const { id } = await ownedForm(c);
    const { revision } = await body(c, z.object({ revision: z.number().int().positive() }));
    const result = await db.transaction(async (tx) => {
      const [form] = await tx.select().from(forms).where(eq(forms.id, id)).for("update");
      if (!form || form.revision !== revision) return { conflict: true as const };
      const draft = acceptForm(form.draft, id);
      if (!draft.fields.some(isInputField)) throw new HTTPException(422, { message: "Add at least one question before publishing" });
      const version = (form.publishedVersion ?? 0) + 1;
      await tx.insert(formVersions).values({ formId: id, version, schema: draft, publishedAt: now() });
      const [row] = await tx.update(forms).set({ publishedVersion: version, publishedRevision: revision }).where(eq(forms.id, id)).returning();
      return { row: row! };
    });
    if ("conflict" in result) return c.json({ error: "Save your latest changes before publishing." }, 409);
    return c.json(summary(result.row));
  });

  app.get("/forms/:id/submissions", async (c) => {
    const { id } = await ownedForm(c);
    const cursor = c.req.query("before")?.match(/^(.+)\|([0-9a-f-]{36})$/);
    const before = cursor ? sql`(${submissions.createdAt}, ${submissions.id}) < (${new Date(cursor[1]!)}, ${cursor[2]})` : undefined;
    const rows = await db
      .select()
      .from(submissions)
      .where(and(eq(submissions.formId, id), before))
      .orderBy(desc(submissions.createdAt), desc(submissions.id))
      .limit(LIMITS.pageSize + 1);
    const page = rows.slice(0, LIMITS.pageSize);
    const [{ total } = { total: 0 }] = await db.select({ total: count() }).from(submissions).where(eq(submissions.formId, id));
    // Every version that appears on this page, so the client can label columns.
    const versionNumbers = [...new Set(page.map((s) => s.version))];
    const versions = versionNumbers.length
      ? await db.query.formVersions.findMany({ where: and(eq(formVersions.formId, id), sql`${formVersions.version} in ${versionNumbers}`) })
      : [];
    const last = page.at(-1);
    return c.json({
      total,
      submissions: page.map((s) => ({ id: s.id, version: s.version, data: s.data, createdAt: s.createdAt.toISOString() })),
      versions: Object.fromEntries(versions.map((v) => [v.version, v.schema])),
      nextBefore: rows.length > LIMITS.pageSize && last ? `${last.createdAt.toISOString()}|${last.id}` : null,
    });
  });

  // --- AI: describe a form ---------------------------------------------------

  app.post("/ai/forms", async (c) => {
    if (!generate) return c.json({ error: "AI form generation isn't available right now." }, 503);
    const { description, formId } = await body(
      c,
      z.object({
        description: z.string().trim().min(10, "Describe the form in a few words (at least 10 characters)").max(LIMITS.aiDescriptionChars, `Keep the description under ${LIMITS.aiDescriptionChars} characters`),
        formId: z.string().min(1).max(64).optional(),
      }),
    );
    const t = now();
    if (!(await allow(db, `ai:${hashIp(clientIp(c))}`, LIMITS.aiPerIp.limit, LIMITS.aiPerIp.windowMs, t))) {
      return c.json({ error: "You've generated a lot of forms recently. Try again in an hour." }, 429);
    }
    if (!(await allow(db, "ai:global", LIMITS.aiGlobal.limit, LIMITS.aiGlobal.windowMs, t))) {
      return c.json({ error: "The demo's daily AI limit is used up. Try again tomorrow." }, 429);
    }
    const started = performance.now();
    let result: GenerateResult;
    try {
      result = await generate(description, formId ?? `form_${newFormId()}`);
    } catch (err) {
      console.error(JSON.stringify({ event: "ai_generate", ok: false, ms: Math.round(performance.now() - started), error: String(err).slice(0, 200) }));
      return c.json({ error: "The AI service didn't respond. Please try again." }, 502);
    }
    // One line per call: the source of the latency and token figures in the case study.
    console.log(JSON.stringify({ event: "ai_generate", ok: result.ok, ms: Math.round(performance.now() - started), attempts: result.attempts, inputTokens: result.inputTokens, outputTokens: result.outputTokens }));
    if (!result.ok) return c.json({ error: result.error }, 422);
    return c.json({ form: result.form });
  });

  // --- Public endpoints (share link) -----------------------------------------

  app.get("/public/forms/:id", async (c) => {
    const form = await db.query.forms.findFirst({ where: eq(forms.id, c.req.param("id")), columns: { publishedVersion: true } });
    if (!form?.publishedVersion) return c.json({ error: "This form isn't published" }, 404);
    const version = await db.query.formVersions.findFirst({
      where: and(eq(formVersions.formId, c.req.param("id")), eq(formVersions.version, form.publishedVersion)),
    });
    return c.json({ form: version!.schema, version: version!.version });
  });

  app.post("/public/forms/:id/submissions", async (c) => {
    const formId = c.req.param("id");
    const { version, values, website } = await body(
      c,
      z.object({ version: z.number().int().positive(), values: z.record(z.string(), z.unknown()), website: z.string().optional() }),
    );
    // Honeypot: a hidden field people never see. Pretend success so bots don't adapt.
    if (website) return c.json({ id: crypto.randomUUID() }, 201);

    if (!(await allow(db, `submit:${formId}:${hashIp(clientIp(c))}`, LIMITS.submissions.limit, LIMITS.submissions.windowMs, now()))) {
      return c.json({ error: "Too many submissions. Please wait a few minutes and try again." }, 429);
    }
    // Validate against the version the person actually filled in, even if a newer one was published meanwhile.
    const formVersion = await db.query.formVersions.findFirst({ where: and(eq(formVersions.formId, formId), eq(formVersions.version, version)) });
    if (!formVersion) return c.json({ error: "This form isn't published" }, 404);

    const result = validateSubmission(formVersion.schema, values as FormValues);
    if (!result.ok) return c.json({ error: "Some answers need attention", errors: result.errors }, 422);
    const [row] = await db.insert(submissions).values({ formId, version, data: result.data, createdAt: now() }).returning({ id: submissions.id });
    return c.json({ id: row!.id }, 201);
  });

  return app;
}

export type App = ReturnType<typeof createApp>;

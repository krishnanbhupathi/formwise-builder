import type { FieldValue, FormSchema } from "@formwise/renderer/core";
import { foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

const createdAt = timestamp({ withTimezone: true }).notNull().defaultNow();

/** A form's editable draft. `id` is public (it's in the share link); the edit token is not. */
export const forms = pgTable("forms", {
  id: text().primaryKey(),
  /** SHA-256 of the edit token; the token itself is only ever in the owner's link. */
  editTokenHash: text().notNull(),
  draft: jsonb().$type<FormSchema>().notNull(),
  /** Bumped on every save; a save must name the revision it was based on (optimistic locking). */
  revision: integer().notNull().default(1),
  publishedVersion: integer(),
  /** The draft revision that was last published, to show "unpublished changes". */
  publishedRevision: integer(),
  createdAt,
  updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Frozen copies of a form, one per publish. Submissions point at the version they answered. */
export const formVersions = pgTable(
  "form_versions",
  {
    formId: text().notNull().references(() => forms.id, { onDelete: "cascade" }),
    version: integer().notNull(),
    schema: jsonb().$type<FormSchema>().notNull(),
    publishedAt: createdAt,
  },
  (t) => [primaryKey({ columns: [t.formId, t.version] })],
);

export const submissions = pgTable(
  "submissions",
  {
    id: uuid().primaryKey().defaultRandom(),
    formId: text().notNull(),
    version: integer().notNull(),
    data: jsonb().$type<Record<string, FieldValue>>().notNull(),
    createdAt,
  },
  (t) => [
    foreignKey({ columns: [t.formId, t.version], foreignColumns: [formVersions.formId, formVersions.version] }).onDelete("cascade"),
    index().on(t.formId, t.createdAt.desc(), t.id.desc()),
  ],
);

/** Fixed-window counters; `key` already contains a hashed IP, never the raw address. */
export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text().notNull(),
    windowStart: timestamp({ withTimezone: true }).notNull(),
    count: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);

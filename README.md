# Formwise

A drag-and-drop form builder. Build a form from a palette of field types, set validation and show-if conditions, and see it live in the real renderer. The form is stored as a versioned, Zod-validated JSON schema.

The renderer is a separate package (`@formwise/renderer`). It also powers the intake form in [Slotwise](https://github.com/krishnanbhupathi/slotwise-booking), the companion booking tool.

> Status: Day 5 of 7. Next: AI "describe your form", the renderer as Slotwise's intake form, and deploy (see [PROGRESS.md](PROGRESS.md)).

## What works today
- **Palette → canvas:** drag a field type onto the canvas, or click it to insert it after the selected question.
- **Reorder:** drag by the handle, or use the keyboard (Tab to the handle, Space, arrow keys, Space). Screen readers hear question names, not ids.
- **Properties panel:**
  - Label, help text, required.
  - Per-type settings: length limits, number range and whole-number rule, date range, accepted file types and size, and dropdown options (add, rename, reorder, remove).
  - Show-if conditions.
- **Live preview:** the real `<FormRenderer>`, with inline validation. "Test submit" shows the exact data a submission would store.
- **Field types:** short and long answer, email, number, dropdown, checkbox, date, file, section heading.
- **Undo/redo:** toolbar buttons, Cmd/Ctrl+Z, and Shift+Cmd/Ctrl+Z (or Ctrl+Y). Typing in a property is one step, not one per keystroke, and undo brings back a condition that a move or deletion removed.
- **Save, publish, share:**
  - Saving gives a private edit link; there are no accounts.
  - Drafts autosave.
  - Publish freezes a numbered version, and the public link `/f/<id>` serves it.
  - Edits stay private until you publish again.
- **Submissions:** the server validates each submission with the same code as the browser. The owner sees a table and can export CSV.

## How it's built

```
packages/renderer   @formwise/renderer: schema (Zod), validation, <FormRenderer>, styles.css
                    (@formwise/renderer/core = schema + validation without React)
apps/builder        Vite + React SPA: Zustand store, dnd-kit canvas, Tailwind
apps/api            Hono API + Drizzle (Postgres); local server or Vercel Functions
api/                Vercel entry that mounts the Hono app at /api
e2e/                Playwright tests against the production build + real API + Postgres
```

**One schema, many readers.** The builder, preview, renderer and export all read the same `FormSchema`. `parseFormSchema` is the gate for anything untrusted (imports, API bodies, AI output). It checks:
- unique ids;
- min ≤ max;
- conditions point only at an *earlier* dropdown, checkbox or short-answer field (which rules out cycles);
- a dropdown condition names an option that exists.

Every exported form carries `version`, and a migration registry upgrades old forms before they're validated.

**Every edit is a command.** The UI never mutates the form directly. It dispatches commands such as `addField`, `moveField` and `updateField` to a pure `applyCommand(form, command)` reducer built with Immer, so unchanged parts keep their identity. This makes edits unit-testable and gives undo/redo a single place to record history.

**Conditions stay valid automatically.** A move, deletion or option removal can break a condition. When that happens, the reducer removes the broken condition and the UI says which question lost it. Rejecting the change instead would make dragging feel broken. A property test applies 300 random edits and checks the schema stays valid after each one.

**Hidden means hidden.** When a field's condition isn't met, `validateSubmission` skips the field and drops its answer. A hidden required question never blocks submission, and stale answers are never stored. Select answers are stored as the option label; conditions match by option id, so renaming an option doesn't break them.

**Undo is snapshots, not inverse commands.** Immer shares every unchanged part of the form, so a snapshot costs little more than what changed, and restoring one can't drift the way hand-written inverses can. Keystrokes that edit the same property within one second merge into a single step (capped at 100 steps).

**Owning a form without accounts:**
- Saving creates a 256-bit edit token. The server stores only its SHA-256 hash and compares tokens in constant time.
- The edit link carries the token in the URL fragment (`/edit/<id>#<token>`), which browsers never send to servers or put in Referer headers.
- The app sends it as a Bearer header. This browser also remembers it, for "My forms".

**Drafts vs. published versions:**
- Autosave sends the draft with the revision it was based on. A stale save gets a 409 and stops autosave, so a second tab can't silently overwrite the first.
- Publish freezes the saved revision as version N.
- Each submission records its version and is validated against that version on the server. Publishing while someone is mid-form doesn't reject their answers.
- The submissions table keeps columns for questions that later versions removed.

**Public endpoint hygiene:**
- 256 KB body limit.
- A honeypot field; caught bots get a fake success so they don't adapt.
- A per-IP, per-form fixed-window rate limit in Postgres, keyed by a hashed IP, never the address.
- The CSV is built in the browser, so the token never goes in a URL. Cells starting with `= + - @` are escaped against spreadsheet formula injection.

**File fields record metadata only.** Name, size and type are checked against the field's rules; there's no file storage in this MVP.

### Trade-offs
| Choice | Why | Cost |
|---|---|---|
| Vite SPA + small API (not Next.js) | The builder is entirely client-side; this keeps it simple and fast | Two deploy targets once the API lands |
| `@dnd-kit/core` + `sortable` (stable) | Mature keyboard sensor and screen-reader announcements | `@dnd-kit/react` is the future API but still 0.x |
| Renderer styled with plain CSS + `--fw-*` variables | Works in hosts without Tailwind (e.g. Slotwise); themable | A second styling approach alongside Tailwind |
| Inspector tabs (Properties / Preview) | Fits a laptop screen next to the canvas | Preview and properties aren't visible at the same time |
| Secret edit links instead of accounts | No sign-up, so a demo takes seconds | Lose the link and you lose access; no "my forms" across devices |
| Hono inside the same Vercel project | One domain, no CORS, one deploy | API and SPA deploy together |
| Rate limit in Postgres | No extra service (Redis/KV) | One upsert per public request; not an edge-level defence |
| Hand-written 4-route router | No dependency for pathname + pushState | Would swap for a router library as routes grow |

## Run it

```bash
npm install
cp .env.example .env.local   # set DATABASE_URL (e.g. postgres://localhost/formwise)
npm run db:migrate
npm run dev          # API on :8787 + builder on http://localhost:5173 (proxies /api)
npm test             # Vitest (unit + component)
npm run e2e          # Playwright, desktop + Pixel 7; needs a formwise_e2e database (E2E_DATABASE_URL)
npm run typecheck && npm run lint
```

## Tests
- **120 Vitest tests** in total (37 renderer, 65 builder, 18 API). Renderer and builder cover:
  - schema rules and versioning;
  - validation, including conditional and hidden fields, files and numbers;
  - the renderer component;
  - the command reducer, with a 300-step random-edit property test;
  - undo/redo history and its shortcuts;
  - the autosave controller (debounce, edits during a save, conflicts, retry, publish);
  - CSV and the router.
- The **18 API tests** run against PGlite (Postgres compiled to WASM) and cover:
  - edit-token auth;
  - optimistic locking;
  - publishing;
  - server-side validation against old versions;
  - the honeypot and rate limits;
  - pagination.
- **13 Playwright tests (+1 skipped)** on desktop Chrome and Pixel 7, against the production build, the real API and Postgres. They cover:
  - building with mouse and keyboard;
  - conditions and undo;
  - save → publish → fill the public link → read and export the submission;
  - edit links in a fresh browser;
  - a stale second tab.

  The mouse-drag test is skipped on mobile.

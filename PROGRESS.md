# Progress

Spec: "Case Study Build Plan" (Claude Doc). Formwise is days 4–6 of the week (Day 4 = Mon 19 Oct 2026); built ahead of schedule on 15 Oct.

## Status: end of session 2 (Day 5 scope)

**Day 5 is complete:** undo/redo; save, publish and share; server-validated submissions; the submissions table and CSV export. Green in CI (unit + e2e with Postgres). **Not deployed:** Vercel and Neon aren't set up yet. Slotwise deploys first.

### Done
**Day 4** (session 1): renderer package (schema, validation, `<FormRenderer>`), builder (palette, dnd-kit canvas, properties panel, live preview), command reducer + store.

**Day 5**
- **Undo/redo** (`state/history.ts`):
  - Snapshot history, max 100 steps.
  - Typing in the same property within 1s is one step.
  - Toolbar plus Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z and Ctrl+Y, ignored inside the preview form.
  - Undo restores conditions removed by a move or delete.
- **API** (`apps/api`, Hono + Drizzle, Postgres):
  - `forms`, `form_versions`, `submissions`, `rate_limits`.
  - Edit token stored as SHA-256 and compared in constant time.
  - Optimistic-locking saves (409).
  - Publish freezes version N, serving `/api/public/forms/:id`.
  - Submissions validated server-side against the version filled in.
  - Honeypot, per-IP rate limits (hashed), 256 KB body limit.
  - Keyset-paginated submissions.
  - `/api/health`, which also pings the DB.
- **Vercel wiring:** `api/[[...route]].ts` mounts the Hono app. `vercel.json` migrates, builds the renderer and SPA, adds SPA rewrites and security headers. Not tried on Vercel yet.
- **Renderer:** `@formwise/renderer/core` entry (no React) used by the API; `.js` import extensions so the published types work under NodeNext.
- **SPA pages:**
  - `/`: new form; Save creates it.
  - `/edit/<id>#<token>`: autosave status, Publish / Publish changes, Share dialog.
  - `/edit/<id>/submissions`: table, Load more, CSV export.
  - `/f/<id>`: public form, thank-you page.
  - `/forms`: forms remembered in this browser.
- **Autosave** (`lib/autosave.ts`): a plain controller.
  - Debounces saves.
  - Saves edits made during a request once it finishes.
  - Stops on a conflict, with a Reload prompt.
  - Retries after errors.
  - Publish always saves first.
  - Pending edits are flushed when you leave the editor.
- **Bugs found and fixed by tests:**
  - Clearing a question's label deleted the required property and crashed the canvas.
  - Leaving the editor within ~1s of an edit dropped the save.
  - A key event targeted at `window` crashed the shortcut handler.
- **Tests:** **120 Vitest** (37 renderer, 65 builder, 18 API on PGlite) + **13 Playwright** (+1 skipped: mouse drag on mobile), desktop + Pixel 7, against the production build, the real API and Postgres. All passing locally and in CI.

### Next (Day 6)
1. AI "describe your form" → schema. The model's output goes through `parseFormSchema` and then `replaceForm`, so it can be undone. Needs an AI API key from Krishna. It's 4th in the cut order.
2. The renderer as Slotwise's intake form: publish `@formwise/renderer` (needs the npm scope) or vendor it. Validate on Slotwise's server with `/core`.
3. Tests for both.
4. Deploy both apps once the accounts exist.

### Decisions
| Date | Decision | Why |
|---|---|---|
| 15 Oct | Name Formwise; repo `formwise-builder` | Krishna |
| 15 Oct | Vite SPA + Hono API | Krishna |
| 15 Oct | Publish the renderer to npm | Krishna; npm scope decided on Day 6 |
| 15 Oct | `@dnd-kit/core` + `sortable` rather than `@dnd-kit/react` | Stable, keyboard sensor, announcements |
| 15 Oct | Commands + pure reducer (Immer) | Testable edits; one place for undo/redo |
| 15 Oct | Broken conditions are removed, with a notice | Dragging never feels "blocked"; undo will restore |
| 15 Oct | Conditions only point at earlier fields | No cycles by construction; matches reading order |
| 15 Oct | Select answers stored as the label; conditions match by option id | Readable submissions; renaming an option doesn't break conditions |
| 15 Oct | Min > max allowed while typing, flagged on the canvas | Blocking it would fight the user mid-keystroke (typing "10" passes "1") |
| 15 Oct | File fields capture metadata only | No file storage in the MVP; "file field" is 3rd in the cut order |
| 15 Oct | Renderer uses plain CSS variables, not Tailwind | Must drop into Slotwise and npm consumers |
| 15 Oct | Types emitted with `tsc`, JS with tsup | tsup's dts step sets `baseUrl`, which TypeScript 6 rejects |
| Day 5 | Owner access by secret edit link (no accounts) | Krishna |
| Day 5 | Draft + Publish; submissions record their version | Krishna |
| Day 5 | Hono API inside the same Vercel project; new Neon DB | Krishna |
| Day 5 | Undo by snapshots, typing merged per property within 1s | Simple and can't drift; Immer keeps snapshots cheap |
| Day 5 | Edit token in the URL fragment, sent as Bearer | Never in server logs or Referer headers |
| Day 5 | Optimistic locking with `revision` | Two tabs can't silently overwrite each other |
| Day 5 | Server validates against the submitted version | Publishing mid-fill doesn't reject answers |
| Day 5 | Rate limit in Postgres (fixed window, hashed IP) | No extra service; good enough against a script |
| Day 5 | CSV built in the browser, formula-escaped | Token never in a URL; safe in Excel/Sheets |
| Day 5 | Select answers stored as the option label | Readable CSV; unchanged from Day 4 |

### Blocked on Krishna
- **Vercel:** a project for this repo (import from GitHub; root directory = repo root; `vercel.json` sets the rest).
- **Neon:** add it via Vercel → Storage, which sets `DATABASE_URL`. A separate database from Slotwise's.
- **npm:** an account and scope for publishing the renderer (Day 6).
- **AI API key** for "describe your form" (Day 6).

### Known issues
- Vercel's handling of the `api/` function (`.js` imports into `apps/api` TypeScript) is untested until the first deploy; the fallback is bundling the API with tsup.
- On phones the editor header wraps to three rows.
- `rate_limits` rows are never pruned (tiny; add a cleanup when a cron exists).
- An edit link can't be revoked or rotated yet.
- On phones the inspector sits below the canvas, so after tapping a question you scroll down to edit it.
- Browser-automation drags (Claude in Chrome) don't move the pointer in steps, so dnd-kit never activates; Playwright drags with steps and passes.
- The unsaved form at `/` isn't kept on reload until you press Save.

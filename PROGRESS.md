# Progress

Spec: "Case Study Build Plan" (Claude Doc). Formwise is days 4–6 of the week (Day 4 = Mon 19 Oct 2026); built ahead of schedule on 15 Oct.

## Status: end of session 1 (Day 4 scope)

**Day 4 is complete:** a form can be built and previewed. It is not deployed; Vercel isn't set up yet (same blocker as Slotwise).

### Done
- npm workspaces: `packages/renderer` (`@formwise/renderer`, tsup + tsc types, 8.2 kB packed) and `apps/builder` (Vite + React 19 + Tailwind 4), which compiles the renderer from source.
- Schema (`schema.ts`):
  - Zod discriminated union of 9 field types.
  - Rules: unique ids, min ≤ max, and backwards-only conditions on dropdown/checkbox/short answer.
  - `version` + migration registry.
- Validation (`validation.ts`):
  - Visibility resolves condition chains.
  - Per-field Zod validators.
  - Hidden fields are skipped and stripped.
  - File checks use accept/size metadata.
- `<FormRenderer>`:
  - Accessible labels, `aria-invalid`/`describedby`.
  - Errors show on blur or submit.
  - Focus moves to the first error.
  - Themable `styles.css`.
- Builder:
  - Command reducer (`applyCommand`) + Zustand store.
  - Palette (drag or click), dnd-kit sortable canvas with keyboard support and named announcements.
  - Properties panel (all field settings, options editor, show-if editor).
  - Live preview with "Test submit".
  - Notices when a condition is removed; schema problems flagged on the question.
- Tests: **62 Vitest + 7 Playwright** (desktop + Pixel 7, production build), all passing locally.
- CI workflow (lint, typecheck, unit, renderer build, e2e).

### Next (Day 5)
1. Undo/redo: a history stack around `applyCommand`, with typing coalesced into one step per field. Tests first.
2. Conditional logic: already in place from Day 4. Day 5 extends it with "is not" and "is answered" rules only if time allows.
3. Hono API + Postgres:
   - save forms;
   - share link (`/f/<id>`);
   - submissions list.
4. Deploy (needs Vercel; Neon can be shared with Slotwise via a second database).

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

### Blocked on Krishna
- Vercel project for this repo (after Slotwise's).
- npm account/scope for publishing the renderer (needed Day 6).

### Known issues
- On phones the inspector sits below the canvas, so after tapping a question you scroll down to edit it.
- Typing in the properties panel dispatches a command per keystroke (fine now; undo will coalesce these).
- Browser-automation drags (Claude in Chrome) don't move the pointer in steps, so dnd-kit never activates; Playwright drags with steps and passes.
- No persistence yet: a reload resets to the sample form.

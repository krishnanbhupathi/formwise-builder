# Formwise

A drag-and-drop form builder. Build a form from a palette of field types, set validation and show-if conditions, and see it live in the real renderer. The form is stored as a versioned, Zod-validated JSON schema.

The renderer is a separate package (`@formwise/renderer`). It also powers the intake form in [Slotwise](https://github.com/krishnanbhupathi/slotwise-booking), the companion booking tool.

> Status: Day 4 of 7. Undo/redo, save + share links, submissions and AI "describe your form" come next (see [PROGRESS.md](PROGRESS.md)).

## What works today
- **Palette → canvas:** drag a field type onto the canvas, or click it to insert it after the selected question.
- **Reorder:** drag by the handle, or use the keyboard (Tab to the handle, Space, arrow keys, Space). Screen readers hear question names, not ids.
- **Properties panel:**
  - Label, help text, required.
  - Per-type settings: length limits, number range and whole-number rule, date range, accepted file types and size, and dropdown options (add, rename, reorder, remove).
  - Show-if conditions.
- **Live preview:** the real `<FormRenderer>`, with inline validation. "Test submit" shows the exact data a submission would store.
- **Field types:** short and long answer, email, number, dropdown, checkbox, date, file, section heading.

## How it's built

```
packages/renderer   @formwise/renderer: schema (Zod), validation, <FormRenderer>, styles.css
apps/builder        Vite + React SPA: Zustand store, dnd-kit canvas, Tailwind
e2e/                Playwright tests against the production build
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

**File fields record metadata only.** Name, size and type are checked against the field's rules; there's no file storage in this MVP.

### Trade-offs
| Choice | Why | Cost |
|---|---|---|
| Vite SPA + small API (not Next.js) | The builder is entirely client-side; this keeps it simple and fast | Two deploy targets once the API lands |
| `@dnd-kit/core` + `sortable` (stable) | Mature keyboard sensor and screen-reader announcements | `@dnd-kit/react` is the future API but still 0.x |
| Renderer styled with plain CSS + `--fw-*` variables | Works in hosts without Tailwind (e.g. Slotwise); themable | A second styling approach alongside Tailwind |
| Inspector tabs (Properties / Preview) | Fits a laptop screen next to the canvas | Preview and properties aren't visible at the same time |

## Run it

```bash
npm install
npm run dev          # builder on http://localhost:5173
npm test             # Vitest (unit + component)
npm run e2e          # Playwright, desktop + Pixel 7, against the production build
npm run typecheck && npm run lint
```

## Tests
- 62 Vitest tests:
  - schema rules and versioning;
  - validation, including conditional and hidden fields, files and numbers;
  - the renderer component;
  - command reducer;
  - the store.
- 7 Playwright tests on desktop Chrome and Pixel 7. They cover:
  - building and reordering with mouse and keyboard;
  - conditions;
  - the live preview's validation and submission.

  (The mouse-drag test runs on desktop only.)

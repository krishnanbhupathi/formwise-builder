# Progress

Spec: "Case Study Build Plan" (Claude Doc). Formwise is days 4–6 of the week (Day 4 = Mon 19 Oct 2026); built ahead of schedule on 15 Oct.

## Status: end of session 3 (Day 6 scope)

**Day 6 is complete:** AI "describe your form", and the renderer is now Slotwise's intake form. Deployed at **https://formwise-builder.vercel.app**; CI green (unit + e2e with Postgres).

### Done
**Days 4–5:** see git history. Renderer package, builder, undo/redo, Hono API (save, publish, share, submissions, CSV), deployed to Vercel + Neon.

**Day 6**
- **Describe your form** (`apps/api/src/ai/`):
  - Claude Opus 5.5 fills in a simple *draft* using structured outputs (JSON schema: keys, option text, conditions by key). Day 7 switch from Haiku 5.5: Opus rejects forced tool calls, and Haiku duplicated a question to fake an "is one of" condition.
  - `draftToForm` builds the real `FormSchema` with ids; `parseFormSchema` validates it, with one retry that sends back the exact errors.
  - The result replaces the canvas in one undoable step (Krishna).
  - Guards: descriptions of 10–1000 characters, 10 per IP per hour, 200 per day overall, 503 without a key, 60 s function limit.
  - One JSON log line per call (`ms`, `attempts`, tokens).
  - Tests and local e2e use a deterministic fake model (`FORMWISE_FAKE_AI=1`).
- **Measured so far** (single calls, not yet a benchmark):
  - local call: 3.4 s, 1,741 input / 470 output tokens, first attempt valid;
  - one production request end to end: 5.9 s (may include a cold start).
  - Day 7: collect more from the production logs.
- **Renderer:**
  - `<FormFields>` (questions only, controlled by the host) split out of `<FormRenderer>`, so hosts with their own `<form>` can embed it;
  - `theme` prop (`auto`/`light`/`dark`);
  - Slotwise vendors it (see slotwise-booking).
- **Demo intake form** published on production for Slotwise: `/f/jmdpq5gycd` ("Before your first lesson"). Its edit link is in slotwise-booking's `.env.local` (`FORMWISE_DEMO_EDIT_URL`).
- **Tests:**
  - 137 Vitest: 39 renderer, 65 builder, 33 API (incl. 10 AI draft/generator tests and 5 endpoint tests);
  - 15 Playwright (+1 skipped), all passing locally and in CI.

### Next (Day 7)
1. Measure: Lighthouse on the builder and public form, AI latency from the logs, test counts.
2. 2-minute video, README polish, case-study page on bhupathi.dev.

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
| Day 5 | Neon project in us-east-2 shared by both apps (one database each); functions in `cle1` | Krishna's existing Neon project; same metro as the database |
| Day 6 | AI result replaces the form (undoable) | Krishna |
| Day 6 | Don't publish to npm; Slotwise vendors the renderer | Krishna |
| Day 6 | Model fills a draft format, server assigns ids | Fewer invalid outputs than asking for raw ids/cross-references; validated + one retry |
| Day 6 | Claude Haiku 5.5 | Fast and cheap; quality checked on a real description |
| Day 7 | Visual identity: green-bar form paper (Schibsted Grotesk + IBM Plex Mono, square boxes, canary condition tags, publish stamp), light only | The old UI read as a generic template; fonts self-hosted so there are no third-party requests (Krishna approved the direction) |
| Day 7 | Claude Opus 5.5 via structured outputs | Better forms (no duplicated questions); slower than Haiku (see docs/measurements/ai-opus-2026-10-15.md). Model is an env var, so switching back is a config change |
| Day 6 | Cost guards: per-IP + global daily cap in Postgres | Public demo on Krishna's key |
| Day 5 | API entry `api/index.ts` + `/api/(.*)` rewrite | Vercel's `[[...route]]` catch-all didn't match multi-segment paths outside Next.js |

### Blocked on Krishna
- Nothing for Day 7 except recording the video.


### Known issues
- Conditions only support "equals one value", so "show if Year 11 or above" can't be expressed (the AI picks a single value). Next step: an "is one of" rule.
- Preview deployments have no database (migrations are skipped there, so their API returns errors). Next step: Neon's Vercel integration for a database branch per preview.
- Production contains a few test forms created by the e2e run against it (only reachable with their edit tokens).
- On phones the editor header wraps to three rows.
- `rate_limits` rows are never pruned (tiny; add a cleanup when a cron exists).
- An edit link can't be revoked or rotated yet.
- On phones the inspector sits below the canvas, so after tapping a question you scroll down to edit it.
- Browser-automation drags (Claude in Chrome) don't move the pointer in steps, so dnd-kit never activates; Playwright drags with steps and passes.
- The unsaved form at `/` isn't kept on reload until you press Save.

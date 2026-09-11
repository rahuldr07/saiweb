# Title CRM — the rules that are not local

An implementation of the Claude Design "Title CRM 897". [`README.md`](README.md)
covers what it is and how to run it. This file covers the four invariants that
hold across files, so nothing in the file you are editing will tell you about
them.

## Gates

```bash
npm run lint        # eslint . --max-warnings 0
npm run typecheck   # tsc -b
npm test            # vitest run
npm run build       # tsc -b && vite build
```

All four must pass. CI runs the same four scripts rather than the commands
behind them, so a script and CI cannot drift apart
([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

`typecheck` is `tsc -b`, and all three project configs set `noEmit: true`
(`tsconfig.app.json`, `tsconfig.node.json`, `tsconfig.test.json`). Keep it that
way. A stray `.js` emitted beside a source file wins Vite's resolution over the
`.tsx` it was built from, so the app serves the stale copy and every later edit
looks like it did nothing — which is why `.gitignore` ignores compiler output
under `src/`, `server/`, `api/` and `tests/`, and says so there.

## 1. Time is read through `now()`

```ts
import { now } from '@/lib/clock'
```

`new Date()` and `Date.now()` are lint errors, matched by selector, with the
message naming the replacement (the `no-restricted-syntax` block in
`eslint.config.js`).

Everything dated measures against that one instant: every countdown, overdue
flag, SLA checkpoint, ageing figure and payroll period. It is pinned to
`SEED_NOW` — Mon 3 Aug 2026, 5:30 PM, the end of the working day the design
shows (`src/lib/clock.ts`) — which is what makes the figures on screen the
design's figures, and makes them reproducible in a test. 37 modules under `src/`
read it.

The rule is enforced because it was once only documented. `Payroll.tsx` drifted
back to the wall clock, so approving a run stamped it with a date the rest of
the register disagreed with, and the stamped value could not be pinned in a test
(finding G3 in [`docs/ARCHITECTURE-REVIEW.md`](docs/ARCHITECTURE-REVIEW.md)).

`new Date(2026, 7, 3)` with arguments is fine, and is how seed dates are written
— the selector rejects only the zero-argument form and `Date.now()`.

The restriction is scoped to `**/*.{ts,tsx}`, so the `.mjs` scripts are outside
it by file type. Four paths are exempted explicitly, in the config block that
turns the rule off:

| Path | Why |
| --- | --- |
| `src/lib/clock.ts` | where the clock is defined |
| `src/main.tsx` | the entry point, the one place that may call `setClock(() => new Date())`. It holds no clock call today, so the application runs pinned. |
| `server/**/*.ts` | the server has no seed clock to pin |
| `tests/db/**/*.ts` | fixture keys must be unique per run rather than reproducible |

A test that needs a different date calls `setClock`, and `resetClock` after
(`src/lib/clock.ts`, `tests/rules/clock.test.ts`). Note the name collision:
`setClock` in `src/state/company.ts` is the company's shift-clock setting and has
nothing to do with this one.

## 2. `design.css` is a port, not source

[`src/styles/design.css`](src/styles/design.css) is the design export's
stylesheet, ported verbatim — 1,037 lines in which every colour, radius, shadow,
size and breakpoint is the design's own number, as its header says. Do not tidy
those numbers, consolidate them, reformat the file, or convert it to tokens. It
is the visual contract, and it has to stay diffable against the export.

Additions and corrections go in [`src/styles/index.css`](src/styles/index.css),
after the `@import './design.css'`, with a comment saying what broke and why.
The entries already there are the pattern: the crumb that had to truncate, the
signed-out shell, the filter bar that took a phone into horizontal scroll until
it wrapped.

Import order is load-bearing: Tailwind first, `design.css` second, so the
design's unlayered component rules beat Tailwind's `utilities` layer.

## 3. Two data paths, and the screens are on the seed one

The application runs both ways, and only one of them is wired to the screens.

- **Seed.** The screens read `src/data/*.ts`, bundled at build time rather than
  fetched. That is why `npm run dev` alone shows all of it with no database, and
  why the numbers are the design's. The one dataset that is not a static import
  is the 767-row delivery history: `src/data/deliveries.ts:78` pulls
  `deliveries.json` in dynamically, so its chunk is requested only by the four
  screens that report on it (`src/lib/useDeliveries.ts`).
- **Server.** A Hono API mounts six route modules under `/api`
  (`server/index.ts:48-56`). Queries go through `withTenant()`, so they are
  scoped by row-level security rather than by remembering a `WHERE` clause.
  There is one deliberate exception: the memberships lookup is what you call to
  find a workspace, so it cannot run inside one. It is a narrow
  `SECURITY DEFINER` function returning only the caller's own rows
  (`server/routes/session.ts:54-64`, `app_memberships` in `server/db/rls.sql`).

Exactly two modules under `src/` import `@/lib/api`: `src/state/session.tsx` and
`src/screens/SignIn.tsx`. Capabilities are the one thing already migrated —
`can()` answers from `/api/me` whenever a server is reachable and falls back to
the bundled roles otherwise, and `authority` on the session says which is in
force (`src/state/session.tsx`). Everything else on screen is still seed data.

**Migrating a screen: do it a navigation group at a time, not a screen at a
time.** A group shares its data, so a half-migrated group is the only genuinely
confusing state — half a register from the API and half from the bundle, with no
way to tell which figure came from where (README, *Known scope*;
`docs/ARCHITECTURE-REVIEW.md`, *Phase C*).

`src/data/types.ts` and the database describe the same domain but do not share
field names — `Order` is `{cl, pr, stt, st, co, prop}` where the `orders` table
is `{clientId, productId, status, state, county, property}`
(`src/data/types.ts:233-243`, `server/db/schema.ts:266-284`), and the routes
return table rows unmapped (`server/routes/reference.ts:55-59`). So a migrated
screen needs a mapping, not only a different source.

## 4. The short field names stay short

Six files under `src/data/` are generated from the design export by a script
that is not in this repository — `business`, `catalog`, `hrms`, `org`, `people`
and `production`, each carrying an `AUTO-GENERATED` header, plus the two JSON
datasets; `.gitattributes` marks them `linguist-generated`. The rest of
`src/data/` is hand-written: the domain types (`types.ts`), the loaders that
revive the two JSON datasets (`deliveries.ts`, `quality.ts`), and five smaller
modules of values.

The field names are the design's own: `n` a name, `k` a key, `st` a status, and
`d` a date in most shapes but a description in four (`Shift`, `Connector`,
`LeaveType`, `DeclType`) — the design's own inconsistency, copied on purpose.
`src/data/types.ts` says so at the top.

Renaming them makes the seed data and the design disagree, and a regeneration
would put them straight back. For the same reason, a defect fixed in the
generated output is a defect a regeneration reintroduces:
`tests/rules/dates.test.ts` exists as the guard against exactly that. eslint
skips every `src/data/*.ts` and un-ignores only `types.ts`
(`eslint.config.js:16`), because that one is the hand-maintained domain model.

## 5. Type sizes come from the scale, and there are two greys

Typography is set in [`src/styles/index.css`](src/styles/index.css), not in
`design.css` — the design's own sizes are still in the port, and every one of
them is restated in the override layer under invariant 2.

**Never write a raw px font size.** Use a step:

```
--t-micro 10.5   --t-label 13     --t-lead 16     --t-h1      25
--t-mini  11     --t-small 13.5   --t-h3   18.5   --t-display 28
--t-eyebrow 12   --t-body  14.5   --t-h2   20.5
```

Ten steps replace the design's thirteen unrelated sizes, and every step is
larger than the value it replaced — the lift is biggest at the bottom, where
this app spends most of its time. Inline styles take the token too
(`fontSize: 'var(--t-small)'`); 611 of them across 86 files already do, so a
literal `'12.5px'` appearing again is a regression, not a local choice.

**There is no grey text.** `--gr`, `--gr2` and the sidebar's `--navtx` all
alias to `--ink` / `--navon` in `index.css` — every rule in `design.css` and
every component call site that names one of them (the `.gr` utility alone is
~465 of them) prints in full ink now, not a lighter tone. The tokens are kept
rather than deleted only because `design.css` cannot be edited (invariant 2)
and still names them. Do not reintroduce a grey text colour, hardcoded or
through a new token — restate the alias in `index.css` if a new selector needs
one. This does not touch opacity-based dimming used as a state (a disabled
row, a zero-count chip) — that is a different signal from a text colour and is
out of scope for this rule.

The faces are Geist and Geist Mono, vendored under
[`src/styles/fonts/`](src/styles/fonts) (OFL) rather than fetched, so there is
no third-party request at first paint and no `<link>` in `index.html` to keep in
step. The `@font-face` fallbacks carry `ascent-override`/`size-adjust` computed
from Geist's own head/hhea/OS-2 tables — that, not a preload, is what stops the
swap from shifting layout. If the fonts are ever replaced, those four numbers
have to be recomputed from the new files or the overrides become wrong.

## Comments

Comments here say *why* — a bug that was hit, an invariant, a constraint — in
the present tense. A comment restating what the line does is noise; so is one
narrating the repository's history.

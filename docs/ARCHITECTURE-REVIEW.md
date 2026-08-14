# Title CRM — architecture and design review

Reviewed against `157e3fb` on `claude/design-architecture-review-ib3i4n`, 08/14/2026.
**All four phases have since been carried out** — see `## Outcome` at the end for
what closed, what only partly closed, and two places where this review was wrong.
Method: full read of `src/` and `server/`, a production build, and a direct comparison
against the recovered Claude Design export.

Every claim below cites the file and line it came from. Build and lint were run
locally; bundle figures are read from `dist/` after `npm run build`.

## Where it stands

| | |
| --- | --- |
| 32,839 | lines across `src/` and `server/` |
| 24 | routes, all deep-linkable and lazy |
| 28 | tables under row-level security |
| **0** | tests, and no CI |
| **1** | write endpoint on the whole API |
| 348 KB | seed chunk pulled onto almost every route |

The build is clean, `tsc` passes, and `eslint` reports nothing. The design port is
meticulous — the stylesheet is verbatim, the seed figures are the design's own, and
`src/lib/permissions.ts` matches the export's `NAVPERM` line for line, including its
three deliberate inversions.

The problem is structural, and the README states it plainly: the screens read bundled
TypeScript, not the API. Two permission systems, two clocks and two sources of truth
for every domain rule now exist in parallel. They agree today because one was copied
from the other. Nothing keeps them agreeing tomorrow.

## The architecture as built

There are two complete paths from a screen to data, and only one is used — the one
with no enforcement on it.

```
                    import at build time
   24 screens ──────────────────────────────▶  src/data/*.ts
       │                                       767 deliveries · frozen clock
       │                                       no tenant · no auth · no server
       │
       └╌╌╌╌╌╌╌╌╌╌╌▶  Hono /api ──▶ withTenant() ──▶ Postgres
         no screen      session +     one            RLS, 28 tables
         calls this     caps          transaction
```

Tenant isolation, capability checks and the QC self-review rule are all implemented on
the lower path. Every screen takes the upper one, where none of them exist. This was a
deliberate, documented staging decision and the data shapes were kept identical on both
sides so the swap would be contained — that judgement was right. But the longer both
halves exist, the more the bundled half accretes behaviour the API half never learns.

## What holds up

These are the parts a rewrite would be wrong to touch.

- **Tenant isolation is in the right place.** Every business table carries `tenant_id`,
  every handler goes through `withTenant()`, and the policy is `FORCE`d so it survives
  table ownership. `set_config(…, true)` is transaction-local, so a pooled connection
  cannot carry one workspace's scope into the next request.
- **The `x-tenant-id` header is not a hole.** It looks like one, but the middleware
  resolves capabilities *inside* the requested tenant for the signed-in user; a
  non-member gets an empty set and a 403 before any handler runs. Verified by reading
  the path (`server/index.ts:56-81`), not assumed.
- **Permissions as rows, not token claims.** The reasoning in `server/auth.ts` is right:
  a person holding different roles in two companies is not expressible in an identity
  provider's claims.
- **QC independence is enforced twice.** The engine filters the author out, the picker
  filters them out, and the API re-checks before writing (`server/index.ts:180-190`),
  returning 409 rather than trusting the client.
- **The assignment engine explains itself.** Every unplaced stage carries one of five
  reasons, each with a different remedy — and the trace records rules that fired without
  narrowing anything, so a rule that does nothing becomes visible.
- **Derived state has no manual override.** "Late" is computed from the due datetime;
  payroll derives from one CTC figure and attendance feeds deductions without re-entry.
- **Routing and hosting are correct.** One lazy chunk per screen, real paths, and a
  `vercel.json` that gets the SPA rewrite, the immutable asset cache and the `no-cache`
  entry document all right.

## Findings, ranked

### F1 — The documented setup cannot complete · blocker

`rls.sql` creates the application role `NOLOGIN`, but `.env.example` hands that same
role to the connection string. A `NOLOGIN` role cannot authenticate, so following the
README fails at the first database command — and no password is ever set for it.

```
server/db/rls.sql:16   CREATE ROLE app_user NOLOGIN;
.env.example:4         DATABASE_URL=postgres://app_user:change-me@localhost:5432/titlecrm
```

Compounding it, one URL serves two contradictory roles: `npm run db:push` needs DDL so
it must be the owner, while `npm run server` needs RLS so it must *not* be the owner —
owners bypass row-level security entirely.

**Fix.** Split the credentials: `DATABASE_URL` (owner, migrations and seed only) and
`APP_DATABASE_URL` (the `LOGIN` role the server connects as). Give `rls.sql` a
`LOGIN PASSWORD` clause and have `client.ts` read the app URL.

### F2 — Two permission systems that only agree by copying · high

The client resolves capabilities from a static `ROLELIST`; the server joins
`people → roles → role_permissions`. Both are correct, and they match today because one
was transcribed from the other. Once roles become editable through the Company screen —
which the schema already supports via `locked` — the client will be reasoning about a
role set the database no longer has.

```
src/lib/permissions.ts:23   roleOf(person.r).p.includes(capability)   ← static array
server/index.ts:65          join people → roles → role_permissions    ← database
```

**Fix.** Make the server authoritative. `/api/me` already returns `capabilities` — feed
it into `SessionProvider` and have `can()` read it. The nav filter and `RequireCap` need
no changes at all, because they already ask `can()`.

### F3 — No tests, on a codebase whose value is its rules · high

The assignment engine, SLA planner, payroll derivation and coverage matcher are pure
functions over plain data — the easiest thing to test and the most expensive thing here
to get wrong. A payroll or QC-independence regression is a compliance incident, not a
bug report. There is no test runner in `package.json` and no workflow in `.github/`.

**Fix.** Vitest, starting with four properties: a QC stage never equals its paired
stage's assignee; every unplaced stage carries one of the five reasons; stage budget
shares sum to 100 for every product; net equals gross minus deductions for all 28
people. Then CI running `lint · tsc · test`.

### F4 — 348 KB of history shipped to read three constants · medium

`src/data/quality.ts` holds 767 delivery records — and also `BUDGET`, `ONTIMETARGET`
and `LSTATUS`, three small constants four screens need. Because `lib/sla.ts` imports
`BUDGET` from it, the whole history chunk is pulled onto Orders, order detail, Company
and Leads. Measured from the build output:

```
Transitive chunks for the /orders route:
  Orders · ui · router · session · DataTable · csv · sla   =   43 KB
  quality-D_Fu55s_.js                                      =  348 KB
                                                            ─────────
                                                               391 KB raw

Needed from quality.ts on that route: BUDGET — 15 lines.
```

**Fix.** Move the three constants into `src/data/budget.ts` and repoint the six import
sites. About ten lines of change; it takes the Orders route from 391 KB to roughly
44 KB and leaves the history chunk loading only on Performance and My performance,
where it is actually read. Highest benefit-to-effort ratio in this review.

### F5 — The clock is frozen at a literal · medium

`NOW` is a fixed `Date` (`src/lib/format.ts:45`), and every countdown, overdue flag,
SLA checkpoint, ageing calculation and payroll period is measured against it. Pinning
the clock was right for a design port — it is what makes the figures reproducible — but
it is load-bearing in about forty places and becomes a live wire the moment real orders
arrive.

**Fix.** An injected clock: `now()` from context, defaulting to `new Date()`, with the
frozen value supplied by the seed fixture and by tests. Do this *before* wiring the API;
it is mechanical now and scattered later.

### F6 — The engine runs at import time · medium

`engine.ts` executes a full five-day assignment run as a module side effect. Importing
it — which any screen touching orders does — deals 2,160 stage decisions before React
renders. It is fast enough today, but it is also why the engine cannot be handed a
different tenant's roster, a different day, or a test fixture.

```
src/lib/engine.ts:546   export const DAY  = makeDay()
src/lib/engine.ts:547   export const RUN  = runDay(DAY)      ← 2,160 decisions, at import
src/lib/engine.ts:549   export const WORK = staffWork(RUN)
```

**Fix.** The functions underneath are already pure and take their inputs as arguments.
Only the seven module-level constants need to move behind a memoised
`useAssignmentRun()`. This is also what makes F3's engine tests possible at all.

### F7 — Identity switching has the same shape as authentication · medium

`signInAs(id)` sets React state and the application re-derives around a different
person. As a demonstration of the permission model it is excellent — a lead really does
see a different sidebar and register. But it sits at the exact seam where real auth must
go, with no flag separating them (`src/state/session.tsx:33,56`).

**Fix.** Keep it, but gate it behind `import.meta.env.DEV` or an explicit
`VITE_DEMO_IDENTITY` flag so it cannot reach a deployed build.

### F8 — The API covers a third of the domain · scope

Ten endpoints, nine of them reads. Orders, people, clients, products, invoices and
counties are served. Attendance, leave, payroll, payslips, petty cash, recruitment,
leads and the engine configuration tables have schema and RLS policies but no routes —
so eight screens have nowhere to point when the swap happens.

### F9 — A workspace switcher that cannot list workspaces · low

The `tenants` policy admits only the row matching the current setting, which is correct
for isolation. But the top bar offers a workspace switcher, and no endpoint answers
"which workspaces do I belong to" — a question that has to be asked outside any single
tenant's scope.

**Fix.** One deliberately unscoped query against `people` joined to `tenants`, filtered
by `user_id`, in a helper with a comment saying why it is not inside `withTenant()`.

## The plan

Sequenced so each phase is independently shippable. The ordering is not arbitrary:
A and B make C safe.

### Phase A — make it runnable and provable

Nothing else is worth doing until someone else can start the stack and until a
regression announces itself.

1. Split the database credentials — owner URL for migrations, `LOGIN` app role for the
   server. (F1)
2. Extract `budget.ts` — ten lines, and the Orders route drops from 391 KB to ~44 KB. (F4)
3. Add Vitest and the four rule properties. (F3)
4. Add CI: `lint · tsc · test` on push.

### Phase B — remove what will not survive real data

Both are mechanical now and invasive later. Doing them before the API swap means the
swap touches data flow only, not time or module initialisation.

1. Inject the clock; move the frozen value into the seed fixture. (F5)
2. Move the engine run behind a hook. (F6)
3. Gate the identity switcher behind a dev flag. (F7)

### Phase C — make the server authoritative, one group at a time

Do it per navigation group, not per screen — a group shares its data, so a
half-migrated group is the only genuinely confusing state.

1. Capabilities first: `/api/me` into `SessionProvider`. (F2 — nothing downstream changes)
2. Add `GET /api/memberships` so the workspace switcher has something to list. (F9)
3. Reference and Production next — those endpoints already exist.
4. Write the HRMS routes, then migrate that group. (the bulk of F8)
5. Business and Insight last; Performance is the one screen the bundled history
   genuinely suits until there is real delivery data.

### Phase D — prove the isolation already built

The RLS design is the strongest part of this codebase and currently the least exercised.

1. A two-tenant integration test: seed two workspaces, run every endpoint as a member of
   one, assert nothing from the other appears — including on endpoints with a
   deliberately missing `WHERE`.
2. Assert at startup that the app role is not the table owner. Owner-bypass is silent
   and total, so this check should fail loudly.
3. Persist the engine's decision trace into `order_stages.decision`, which the schema
   already has a column for. It turns the Assignment screen's explanation into an
   audit record.

## Design fidelity against the original

The export was deleted from the working tree at `157e3fb`; it was recovered from git
history (`git show 157e3fb^:"reference/Title CRM (original).html"`) and compared directly.

| Design (9,670 lines) | Implementation | Verdict |
| --- | --- | --- |
| `NAVPERM` | `src/lib/permissions.ts` | Exact match, including the three inversions |
| 6 nav groups | `src/app/nav.ts` | Match; Reports → Performance and Report generator → Commitment report are intentional renames |
| Stylesheet | `src/styles/design.css` | Ported verbatim, 885 lines, including the full `body.dark` token set |
| `depts` · `roles` · `staff` · `clients` · `sla` | `Company.tsx` | Consolidated into tabs — an improvement; these were five views of one settings object |
| `newlead` · `neworder` | `Leads.tsx:95` | Order intake covers `neworder`; the New lead button fires a toast, the capture form was not carried over |
| `person` · `client` · `lead` | — | Detail drill-downs not carried over; register rows have nowhere to go |
| Seed figures | `src/data/*` | Extracted by script rather than retyped |

The missing drill-downs are the only real fidelity gap, and they are a scope decision
rather than a defect — but they should be logged as such, since three register screens
render rows that look clickable and are not.

One thing worth reconsidering: the export was deleted because three copies exist
elsewhere. That holds for storage, but the copy in this repository was the only one
under version control alongside the code it governs. If the design is the visual source
of truth, a reference that cannot be diffed against a commit is a weaker reference.
Restoring it under `reference/` with the `linguist-documentation` attribute costs 706 KB
of git history and nothing at build time — it was already excluded from the bundle.


---

# Outcome

Reviewed at `157e3fb`, delivered at `339fad0`. 57 files, +4,630 −638.

| | |
| --- | --- |
| Tests | 74, from 0 |
| Mutations caught by the suite | 7 of 7 attempted |
| API endpoints | 28, from 10 |
| The `/orders` route | 76 KB, from 391 KB |
| Routes rendering with no console errors | 23 of 23 |
| Documented setup completes from a clean database | yes |

## Two corrections to this review

**The heavy-chunk finding named four screens. It was five.** The first
measurement checked *direct* imports, so it caught Orders, order detail, Company
and Leads and missed Dashboard, which reaches the same 348 KB transitively
through `lib/metrics`. A transitive walk finds it immediately. Dashboard is also
the one case the fix does not close — `onTime30()` genuinely computes its figure
from the delivery records, so that screen needs them until the number comes from
the API.

**The first version of the QC-independence test could not fail.** It asserted the
right property and passed with the self-review rule deleted, because filling the
emptiest desk first incidentally moves the author down the list once their load
has gone up. The rule was doing real work; the seeded roster never forced it to.
That is what drove the `RunContext` refactor — not the other way round. The suite
now builds the roster where the rule is the only thing in the way, and asserts
both directions, so it cannot go vacuous again.

## Findings

| | Status | Evidence |
| --- | --- | --- |
| F1 setup cannot complete | fixed | schema dropped and rebuilt with the three README commands |
| F2 two permission systems | fixed | demote the role in the database, same session is refused |
| F3 no tests | fixed | 74 tests; each rule test verified to fail without its rule |
| F4 348 KB for three constants | mostly | four routes fixed; Dashboard genuinely needs the data |
| F5 frozen clock | fixed | clock tests move it and assert the derived judgements move |
| F6 engine ran at import | fixed | run memoised behind `board()`; `runDay` takes a `RunContext` |
| F7 identity switcher | fixed | tree-shaken from production: SignIn 2.16 kB → 0.76 kB |
| F8 API covered a third | fixed | 28 endpoints; self-review re-checked on the write path |
| F9 switcher could not list | fixed | one narrow `SECURITY DEFINER` function, per-user only |

## Mutations, and what caught them

A test that stays green when its rule is deleted is not evidence of anything.
Each of these was applied to the source, the suite run, and the source restored.

| Mutation | Caught by |
| --- | --- |
| self-review rule (r4) removed | `engine.test.ts` — constructed-roster case |
| daily-target rule (r3) removed | `engine.test.ts` — per-day load assertion |
| coverage rule (r6) removed | `engine.test.ts` — place/product assertion |
| a stage budget share changed | `sla.test.ts` — shares sum to 100 |
| `set_config` transaction-local flag dropped | `isolation.test.ts` — scope outliving its transaction |
| `x-tenant-id` membership check removed | `api.test.ts` — three cross-workspace cases |
| server-side self-review re-check removed | `api.test.ts` — the 409 case |

## Still open

- **The screens still render from `src/data/`.** Capabilities come from the
  database; the rows do not. The endpoints exist and the shapes match, so the
  swap is mechanical — but it is per screen and has not been done. A navigation
  group at a time, not a screen at a time.
- **Dashboard still loads the delivery history**, for its on-time KPI. The fix is
  an endpoint returning that figure, which belongs with the screen migration.
- **Three detail drill-downs were never built** — `person`, `client` and `lead` —
  so three register screens render rows that look clickable and are not.
- **New lead raises a toast** rather than opening a capture form.
- **The write surface is thin.** Four endpoints write: stage assignment, a leave
  decision, a rule toggle, tenant settings. Reads first, then the screens, then
  the writes those screens need — but the API cannot yet run the business.
- **The design export is still deleted.** It was recovered from `157e3fb^` for
  this review and used for the comparison, but not restored.

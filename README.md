# Title CRM

A multi-tenant title-production system and HRMS for a US title-abstracting vendor.
It runs the whole business in one application: the production pipeline (orders →
search → QC → typing → QC → delivery), workload assignment, client invoicing in
USD, a full HRMS for the offshore production team, reference data for county
coverage and county-website health, reporting, and company configuration.

This is a faithful implementation of the Claude Design **Title CRM 897**. The
design is the visual source of truth: its stylesheet is ported verbatim into
[`src/styles/design.css`](src/styles/design.css), and its data and rules were
extracted rather than re-typed, so the screens show exactly the numbers the design
does.

## Stack

| Layer | Choice |
| --- | --- |
| Build | Vite 8 |
| UI | React 19 + TypeScript |
| Routing | TanStack Router (code-based, one lazy chunk per screen) |
| Server state | TanStack Query |
| Styling | Tailwind v4 (`@theme` tokens) over the design's own stylesheet |
| Database | Postgres + Drizzle ORM, with row-level security |
| Auth | Better Auth; permissions live in our own tables |
| API | Hono |

## Running it

```bash
npm install
npm run dev
```

The application is then at **http://localhost:5173**.

That is enough to see every screen — the front end ships with the design's seed
data, so it runs with no database.

Every screen deep-links, so you can go straight to one:

| | |
| --- | --- |
| Dashboard | http://localhost:5173/dash |
| Orders | http://localhost:5173/orders |
| Assignment | http://localhost:5173/assign |
| Attendance | http://localhost:5173/attend |
| Payroll | http://localhost:5173/payroll |
| County coverage | http://localhost:5173/counties |
| Link monitor | http://localhost:5173/linkcheck |
| Performance | http://localhost:5173/performance |
| Company | http://localhost:5173/company |
| Switch user | http://localhost:5173/signin |

You start as Harry Whitfield, a company admin. `/signin` switches to any of the
other twenty-seven people — a lead or a member of production staff sees a
different sidebar and a different Orders register, which is the permission model
rather than a demo mode.

To run the API and database as well:

```bash
cp .env.example .env      # fill in the two database URLs and BETTER_AUTH_SECRET
npm run db:push           # create the tables (as the owner)
npm run db:rls            # create app_user and enable row-level security
npm run db:seed           # load the workspaces, people, counties and catalog
npm run server            # API on :8787, proxied from the dev server at /api
```

There are deliberately **two** connection strings, and the difference between them
is the whole of tenant isolation:

| | Role | Used by |
| --- | --- | --- |
| `DATABASE_URL` | the owner, holding `BYPASSRLS` | `db:push` · `db:rls` · `db:seed` |
| `APP_DATABASE_URL` | `app_user` — owns nothing, bypasses nothing | the server |

Row-level security is bypassed entirely for table owners and superusers, so a
server connected as the owner would enforce nothing and look completely normal.
The server therefore checks its own role at startup and refuses to serve if it
would bypass the policies. The seed is the mirror image: creating a workspace
means writing the row every policy scopes against, so it runs as the owner.

`db:rls` passes the password from `APP_DATABASE_URL` through to the script, so
the role it creates and the role the server connects as cannot drift apart.

The API answers on **http://localhost:8787** — check it with
http://localhost:8787/api/health. The dev server proxies `/api` there, so the
front end calls same-origin paths and there is no CORS in development.

Other commands:

```bash
npm run build      # tsc -b && vite build
npm run lint       # eslint
npm run preview    # serve the production build on http://localhost:4173
```

### Deploying

The front end is a static bundle. Two pieces of host configuration matter:

- **SPA fallback.** TanStack Router uses real paths (`/orders`, `/payroll`), so
  unmatched paths must rewrite to `/index.html` or every deep link 404s.
- **Cache headers.** Serve `/assets/*` with
  `Cache-Control: public, max-age=31536000, immutable` — every filename is
  content-hashed — and `index.html` with `no-cache`.

## What is in here

### Screens

Six groups, twenty-two screens, plus the order detail and the account switcher.

| Group | Screens |
| --- | --- |
| Production | My work · My payslips · How I'm doing · Dashboard · Orders (+ order detail) · Assignment · Order intake · Commitment report |
| Business | Leads · Invoicing |
| HRMS | Attendance · Leave · Payroll · Payslips · Recruitment · Petty cash |
| Reference | County coverage · Link monitor |
| Insight | Performance |
| Configure | Integrations · Company · Add a company |

### Layout

```
src/
  app/          shell — sidebar, top bar, nav definition
  components/   the shared vocabulary: chips, cards, KPI tiles, the register table
  screens/      one file per route
  lib/          the rules: assignment engine, SLA planner, payroll, coverage, CSV
  data/         seed data and domain types, extracted from the design
  state/        session (who you are, which company) and UI (modal, toast)
  styles/       Tailwind entry + the design's stylesheet, ported verbatim
server/
  db/           Drizzle schema, RLS policies, seed script
  auth.ts       Better Auth
  index.ts      Hono API
```

### The parts worth knowing about

**The assignment engine** (`src/lib/engine.ts`) places each arriving order across
the five automatic stages, applying the rules in order and recording *why* each
choice was made. It never silently skips a person: an unplaced stage always
carries one of five reasons — everyone at their daily target, nobody in the
department, nobody available, would be self-review, or nobody covers that place or
product. Each has a different fix, which is why the Assignment screen groups
exceptions by cause.

**QC independence** is structural. A QC stage can never be given to the person who
performed the stage it reviews. The engine filters them out, the order detail
screen filters them out of the picker, and the API re-checks it before writing.

**The SLA planner** (`src/lib/sla.ts`) divides the client promise between the
departments after holding back a buffer, then reports whether an order is behind an
internal checkpoint or has genuinely run out of clock. "Late" is computed from the
due datetime everywhere — nobody marks it.

**Payroll** (`src/lib/payroll.ts`) derives everything from one number, the CTC on a
person's record, through a structure that follows the 50% wage rule. Attendance
feeds it directly: an unpaid day on the attendance screen becomes a deduction on
the payslip without anyone re-typing it.

**Tenant isolation** is enforced by Postgres, not by application code. Every
business table carries `tenant_id`, every request runs inside `withTenant()`, and
the RLS policies in [`server/db/rls.sql`](server/db/rls.sql) check it. A forgotten
`WHERE` clause returns nothing rather than another company's orders.

**Permissions** are rows in our own tables, not claims in a token — a person can
hold different roles in two companies, which an identity provider cannot express.
Better Auth answers "who are you"; `roles` and `role_permissions` answer "what may
you do here". Nav items a person lacks are hidden rather than disabled.

## Testing

```bash
npm test            # everything
npm run test:watch  # while working
```

Two suites, because they need different things.

**`tests/rules`** covers the pure domain functions — the assignment engine, the
SLA planner, payroll, the clock. No database, no browser, runs anywhere. These
are properties rather than fixtures: stage budgets sum to 100 for every product,
a payslip nets out to gross minus deductions for all twenty-eight people, tax
never falls as income rises, and no QC stage is ever given to the author of the
stage it reviews.

That last one is the reason `runDay` takes a `RunContext`. Against the seeded
roster the self-review rule can be deleted without any test noticing — not
because it is redundant, but because filling the emptiest desk first incidentally
moves the author down the list once their load has gone up. So the suite builds
the roster where the rule is the only thing in the way (one person in both Search
and Search QC) and asserts *both* directions: with the rule, the stage is refused
and reported; without it, the collision reproduces. A test that cannot fail is
not a test.

**`tests/db`** covers tenant isolation, which can only be tested against a real
Postgres because the thing under test *is* Postgres. An unscoped `SELECT` returns
nothing; a scoped one returns one workspace; a write naming another workspace is
refused by the policy; and the scope does not survive its transaction. It skips
itself when the database URLs are unset, so `npm test` still works with nothing
installed.

## The API

Ten of these existed before; the rest were written so the HRMS and business
screens have somewhere to point.

| | |
| --- | --- |
| Session | `/api/me` · `/api/memberships` |
| Production | `/api/orders` · `/api/orders/:id` · `POST /api/orders/:id/stages/:stageId` |
| Reference | `/api/people` · `/api/departments` · `/api/roles` · `/api/levels` · `/api/products` · `/api/counties` · `/api/links` |
| Business | `/api/clients` · `/api/invoices` · `/api/leads` |
| HRMS | `/api/hr/attendance` · `/api/hr/leave` · `POST /api/hr/leave/:id/decision` · `/api/hr/payruns` · `/api/hr/payslips` · `/api/hr/petty-cash` · `/api/hr/openings` |
| Configuration | `/api/config/rules` · `POST /api/config/rules/:id` · `/api/config/sla` · `/api/config/stage-budgets` · `/api/config/settings` |

Two patterns run through it. A route serving both a personal and a company view
**narrows to the caller rather than refusing** — "my payslips" and "the pay run"
are one endpoint answering honestly to two different people. And a rule that
exists for a compliance reason is **re-checked on the write path**: assignment
re-runs the self-review check before it writes, and returns 409 rather than
trusting that the picker filtered correctly.

## Known scope

Capabilities now come from the database: `SessionProvider` reads `/api/me`, and
`can()` answers from that whenever a server is reachable, falling back to the
bundled roles for the seed-data build. `authority` on the session says which is
in force.

The screens themselves still render from `src/data/`. That swap is contained —
the shapes in `src/data/types.ts` and the API responses are the same model — but
it is per screen and has not been done. Do it a navigation group at a time
rather than a screen at a time: a group shares its data, so a half-migrated group
is the only genuinely confusing state.

Also outstanding, and carried over from the original design: the `person`,
`client` and `lead` detail drill-downs were never built, so three register
screens render rows that look clickable and are not; and the New lead button
raises a toast rather than a capture form.

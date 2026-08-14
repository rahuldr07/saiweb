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
does. The export itself is kept in [`reference/`](reference) so the implementation
and the design it came from live together.

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
| Reports | http://localhost:5173/reports |
| Company | http://localhost:5173/company |
| Switch user | http://localhost:5173/signin |

You start as Harry Whitfield, a company admin. `/signin` switches to any of the
other twenty-seven people — a lead or a member of production staff sees a
different sidebar and a different Orders register, which is the permission model
rather than a demo mode.

To run the API and database as well:

```bash
cp .env.example .env      # fill in DATABASE_URL and BETTER_AUTH_SECRET
npm run db:push           # create the tables
psql "$DATABASE_URL" -f server/db/rls.sql   # enable row-level security
npm run db:seed           # load the workspaces, people, counties and catalog
npm run server            # API on :8787, proxied from the dev server at /api
```

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
| Production | My work · My payslips · How I'm doing · Dashboard · Orders (+ order detail) · Assignment · Order intake · Report generator |
| Business | Leads · Invoicing |
| HRMS | Attendance · Leave · Payroll · Payslips · Recruitment · Petty cash |
| Reference | County coverage · Link monitor |
| Insight | Reports |
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

## Known scope

The front end runs against the design's seed data. The API, schema, RLS policies
and seed script are in place and cover the core domain — tenants, people, roles,
departments, orders and their stages, clients, products, counties and links,
invoices, leave, attendance, pay runs, petty cash and recruitment — but the screens
have not yet been switched over from the bundled data to TanStack Query calls
against it. That swap is contained: the data shapes in `src/data/types.ts` and the
API responses are the same model.

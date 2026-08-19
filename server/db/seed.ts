/**
 * Seeds a workspace from the same data the front end ships with, so a fresh
 * database matches the screens exactly.
 *
 *   npm run db:push && npm run db:seed
 *
 * This runs as the **owner** (`DATABASE_URL`), not as the application role.
 * Creating a workspace means writing the very row that every RLS policy scopes
 * against, so there is no scope to be inside while doing it — which is why the
 * owner holds `BYPASSRLS` and the server does not.
 */
import { eq } from 'drizzle-orm'
import { createDb, withTenantOn } from './connect'
import { auth } from '../auth'
import {
  assignmentRules,
  clients,
  counties,
  countyLinks,
  departments,
  levels,
  people,
  peopleDepartments,
  products,
  rolePermissions,
  roles,
  tenantSettings,
  tenants,
} from './schema'

import { TENANTS, DEPTLIST, ROLELIST, RULES } from '../../src/data/org'
import { STAFF } from '../../src/data/people'
import { PRODUCTS, COUNTIES, CLIENTS, LINKTYPES } from '../../src/data/catalog'
import { LEVELS } from '../../src/data/org'
import { BUDGET } from '../../src/data/budget'

/** Development sign-in password, shared by every seeded account. Never for real records. */
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'titlecrm-dev'

const url = process.env.DATABASE_URL
if (!url) {
  throw new Error(
    'DATABASE_URL is not set. The seed runs as the owning role, not as the ' +
      'application role — copy .env.example to .env and fill it in.',
  )
}
const { db, queryClient } = createDb(url, 1)
const withTenant = <T>(tenantId: string, fn: Parameters<typeof withTenantOn<T>>[2]) =>
  withTenantOn(db, tenantId, fn)

async function main() {
  console.log('seeding…')

  /* Seeding creates the tenants themselves, which the RLS policy on `tenants`
     scopes to the current workspace — so this one statement runs unscoped. */
  const created = await db
    .insert(tenants)
    .values(
      TENANTS.filter((t) => t.id !== 'new').map((t) => ({
        slug: t.id,
        name: t.name,
        plan: t.plan,
        state: t.state,
      })),
    )
    .onConflictDoNothing()
    .returning()

  console.log(`  ${created.length} workspaces`)

  for (const tenant of created) {
    /* Only the first workspace gets the full demo data; the others start empty,
       which is what makes tenant isolation visible when you switch. */
    const full = tenant.slug === TENANTS[0].id

    await withTenant(tenant.id, async (tx) => {
      await tx.insert(tenantSettings).values({
        tenantId: tenant.id,
        slaBufferPct: BUDGET.buffer,
      })

      const roleRows = await tx
        .insert(roles)
        .values(
          ROLELIST.map((r) => ({
            tenantId: tenant.id,
            key: r.id,
            name: r.n,
            description: r.desc,
            locked: !!r.lock,
          })),
        )
        .returning()

      await tx.insert(rolePermissions).values(
        ROLELIST.flatMap((r) => {
          const row = roleRows.find((x) => x.key === r.id)!
          return r.p.map((capability) => ({ roleId: row.id, capability }))
        }),
      )

      const deptRows = await tx
        .insert(departments)
        .values(
          DEPTLIST.map((d, i) => ({
            tenantId: tenant.id,
            key: d.id,
            name: d.n,
            description: d.desc,
            auto: d.auto,
            pairs: d.pair,
            position: i,
          })),
        )
        .returning()

      await tx.insert(products).values(
        PRODUCTS.map((p) => ({
          tenantId: tenant.id,
          code: p.id,
          name: p.n,
          fee: String(p.fee),
          slaHours: p.h,
        })),
      )

      await tx.insert(assignmentRules).values(
        RULES.map((r, i) => ({
          tenantId: tenant.id,
          key: r.id,
          name: r.n,
          kind: r.k,
          enabled: r.on,
          locked: !!r.lock,
          position: i,
          condition: r.cond ?? null,
          pool: r.pool ?? null,
          statement: r.then ?? '',
        })),
      )

      if (!full) return

      await tx.insert(levels).values(
        LEVELS.map((l) => ({
          tenantId: tenant.id,
          name: l.n,
          note: l.note,
          states: l.states === 'all' ? null : l.states,
          counties: l.counties ?? {},
          products: l.products === 'all' ? null : l.products,
        })),
      )

      await tx.insert(clients).values(
        CLIENTS.map((c) => ({
          tenantId: tenant.id,
          code: c.n,
          name: c.dn,
          email: c.e,
          phone: c.p,
          terms: c.terms,
          active: c.active,
        })),
      )

      const countyRows = await tx
        .insert(counties)
        .values(
          COUNTIES.map((c) => ({ tenantId: tenant.id, name: c.n, state: c.st, idx: c.idx })),
        )
        .returning()

      await tx.insert(countyLinks).values(
        COUNTIES.flatMap((c) => {
          const row = countyRows.find((x) => x.name === c.n && x.state === c.st)!
          return LINKTYPES.map((t) => ({
            tenantId: tenant.id,
            countyId: row.id,
            kind: t.k,
            url: c.links[t.k]?.u ?? '',
            status: c.links[t.k]?.s ?? 'unchecked',
          }))
        }),
      )

      const staffRoleId = (key: string) => roleRows.find((r) => r.key === key)?.id

      const personRows = await tx
        .insert(people)
        .values(
          STAFF.map((p) => ({
            tenantId: tenant.id,
            ref: p.id,
            name: p.n,
            email: p.e,
            roleId: staffRoleId(p.r),
            capacity: p.cap,
            availability: p.avail,
            shift: p.shift,
            active: p.active,
            ctc: p.ctc ?? null,
          })),
        )
        .returning()

      await tx.insert(peopleDepartments).values(
        STAFF.flatMap((p) => {
          const person = personRows.find((x) => x.ref === p.id)!
          return p.dep
            .map((name) => deptRows.find((d) => d.name === name))
            .filter((d): d is (typeof deptRows)[number] => !!d)
            .map((d) => ({ personId: person.id, departmentId: d.id }))
        }),
      )

      console.log(`  ${tenant.name}: ${personRows.length} people, ${countyRows.length} counties`)

      /*
       * Sign-in credentials.
       *
       * Without these the schema is complete and nobody can get in: `people` rows
       * carry an email, but Better Auth keeps identity in its own tables and there
       * was nothing writing to them. Every seeded person gets an account so each
       * role can actually be signed into and checked.
       *
       * The password is deliberately one shared, obvious, development-only value —
       * a seed that invents different secrets per person is a seed whose output
       * has to be captured to be usable. Anything holding real records must not be
       * seeded with it, which is why it is printed rather than hidden.
       */
      for (const p of personRows) {
        const created = await auth.api
          .signUpEmail({ body: { email: p.email, password: SEED_PASSWORD, name: p.name } })
          .catch((e: unknown) => {
            /* An existing address is fine — re-running the seed should not fail on
               accounts that survived from the last run. */
            const message = e instanceof Error ? e.message : String(e)
            if (/exist/i.test(message)) return null
            throw e
          })
        if (created?.user) {
          await tx.update(people).set({ userId: created.user.id }).where(eq(people.id, p.id))
        }
      }

      console.log(`  ${tenant.name}: ${personRows.length} sign-ins, password "${SEED_PASSWORD}"`)
    })
  }

  console.log('done')
}

main()
  .then(() => queryClient.end({ timeout: 5 }))
  .then(() => process.exit(0))
  .catch(async (e) => {
    console.error(e)
    await queryClient.end({ timeout: 5 }).catch(() => {})
    process.exit(1)
  })

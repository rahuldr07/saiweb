import { beforeAll, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { createDb, assertRlsApplies, withTenantOn, type Db } from '../../server/db/connect'
import { counties, orders, people, tenants } from '../../server/db/schema'

/**
 * Tenant isolation is enforced by Postgres, so it can only be tested against
 * Postgres. These are the tests that would actually catch a regression: the RLS
 * design is the strongest thing in this codebase and was, until now, the least
 * exercised.
 *
 * They skip themselves when there is no database, so `npm test` still runs the
 * rule suites on a machine with nothing installed.
 */

const ownerUrl = process.env.DATABASE_URL
const appUrl = process.env.APP_DATABASE_URL
const configured = Boolean(ownerUrl && appUrl)

/**
 * Drizzle wraps a driver error in one of its own, so the Postgres text — the
 * part that says *why* the write was refused — is on the cause rather than the
 * message. Asserting on the wrapper would pass for any failure at all, which
 * would make these tests agree with a broken policy as readily as a working one.
 */
async function refusal(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
  } catch (e) {
    const parts: string[] = []
    let err: unknown = e
    while (err instanceof Error) {
      parts.push(err.message)
      err = err.cause
    }
    return parts.join(' | ')
  }
  throw new Error('expected the write to be refused, but it succeeded')
}

describe.skipIf(!configured)('tenant isolation', () => {
  let owner: Db
  let app: Db
  let keystone: string
  let peach: string

  beforeAll(async () => {
    owner = createDb(ownerUrl!, 2).db
    app = createDb(appUrl!, 2).db

    const rows = await owner.select({ id: tenants.id, slug: tenants.slug }).from(tenants)
    keystone = rows.find((r) => r.slug === 'ka')!.id
    peach = rows.find((r) => r.slug === 'ps')!.id

    expect(keystone, 'run npm run db:seed first').toBeDefined()
    expect(peach).toBeDefined()
  })

  describe('the application role', () => {
    it('cannot bypass the policies', async () => {
      /* If this ever passes silently, every test below becomes meaningless — the
         role would be seeing everything regardless of what the policies say. */
      await expect(assertRlsApplies(app)).resolves.toBeUndefined()
    })

    it('refuses to accept the owner, which would disable every policy at once', async () => {
      await expect(assertRlsApplies(owner)).rejects.toThrow(/bypasses row-level security/)
    })
  })

  describe('reading', () => {
    it('sees nothing at all when no workspace is set', async () => {
      /* The failure this guards: a query that forgets its scope returns another
         company's rows. Here it returns none. */
      const [{ n: peopleSeen }] = await app.select({ n: sql<number>`count(*)::int` }).from(people)
      const [{ n: countiesSeen }] = await app.select({ n: sql<number>`count(*)::int` }).from(counties)
      const [{ n: ordersSeen }] = await app.select({ n: sql<number>`count(*)::int` }).from(orders)

      expect(peopleSeen).toBe(0)
      expect(countiesSeen).toBe(0)
      expect(ordersSeen).toBe(0)
    })

    it('sees only the workspace it is inside', async () => {
      const inKeystone = await withTenantOn(app, keystone, (tx) => tx.select().from(people))
      const inPeach = await withTenantOn(app, peach, (tx) => tx.select().from(people))

      expect(inKeystone.length).toBeGreaterThan(0)
      expect(inPeach).toHaveLength(0)
      inKeystone.forEach((p) => expect(p.tenantId).toBe(keystone))
    })

    it('scopes a query that names no workspace at all', async () => {
      /* The whole point of the design: this SELECT has no WHERE clause, and is
         still correct. */
      const rows = await withTenantOn(app, keystone, (tx) => tx.select().from(counties))
      expect(rows.length).toBeGreaterThan(0)
      expect(new Set(rows.map((r) => r.tenantId))).toEqual(new Set([keystone]))
    })

    it('cannot reach another workspace by naming its id explicitly', async () => {
      const rows = await withTenantOn(app, peach, (tx) =>
        tx.select().from(people).where(sql`${people.tenantId} = ${keystone}`),
      )
      expect(rows, 'asking for another tenant by id returned rows').toHaveLength(0)
    })

    it('shows one workspace on the tenants table itself', async () => {
      const rows = await withTenantOn(app, keystone, (tx) => tx.select().from(tenants))
      expect(rows).toHaveLength(1)
      expect(rows[0].id).toBe(keystone)
    })
  })

  describe('writing', () => {
    it('refuses a row belonging to another workspace', async () => {
      const why = await refusal(() =>
        withTenantOn(app, peach, (tx) =>
          tx.insert(counties).values({ tenantId: keystone, name: 'Smuggled', state: 'PA' }),
        ),
      )
      expect(why).toMatch(/row-level security/)
    })

    it('refuses a row with no workspace scope set', async () => {
      const why = await refusal(() =>
        app.insert(counties).values({ tenantId: keystone, name: 'Unscoped', state: 'PA' }),
      )
      expect(why).toMatch(/row-level security/)
    })

    it('cannot update another workspace’s rows', async () => {
      const before = await withTenantOn(app, keystone, (tx) => tx.select().from(people))

      const updated = await withTenantOn(app, peach, (tx) =>
        tx.update(people).set({ name: 'Renamed by another tenant' }).returning({ id: people.id }),
      )
      expect(updated, 'an unscoped UPDATE reached across workspaces').toHaveLength(0)

      const after = await withTenantOn(app, keystone, (tx) => tx.select().from(people))
      expect(after.map((p) => p.name).sort()).toEqual(before.map((p) => p.name).sort())
    })

    it('cannot delete another workspace’s rows', async () => {
      const before = await withTenantOn(app, keystone, (tx) => tx.select().from(counties))

      const deleted = await withTenantOn(app, peach, (tx) =>
        tx.delete(counties).returning({ id: counties.id }),
      )
      expect(deleted, 'an unscoped DELETE reached across workspaces').toHaveLength(0)

      const after = await withTenantOn(app, keystone, (tx) => tx.select().from(counties))
      expect(after.length).toBe(before.length)
    })
  })

  describe('the transaction-local setting', () => {
    it('does not leak the scope into the next request on a pooled connection', async () => {
      /* `set_config(..., true)` is what makes this true. Without the third
         argument the setting would outlive the transaction and the next request
         on that connection would inherit somebody else's workspace. */
      await withTenantOn(app, keystone, async (tx) => {
        const rows = await tx.select().from(people)
        expect(rows.length).toBeGreaterThan(0)
      })

      const [{ n }] = await app.select({ n: sql<number>`count(*)::int` }).from(people)
      expect(n, 'the workspace scope outlived its transaction').toBe(0)
    })
  })

  describe('every business table', () => {
    it('is under FORCEd row-level security', async () => {
      /* A new table added without a policy is the realistic way this design
         decays — it looks fine until that one table leaks. */
      const rows = await owner.execute<{ tablename: string }>(sql`
        select c.relname as tablename
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind = 'r'
          and c.relname not in ('user', 'session', 'account', 'verification', '__drizzle_migrations')
          and not (c.relrowsecurity and c.relforcerowsecurity)
      `)
      expect(Array.from(rows).map((r) => r.tablename)).toEqual([])
    })
  })
})

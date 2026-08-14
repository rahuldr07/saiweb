import { beforeAll, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { createDb, withTenantOn, type Db } from '../../server/db/connect'
import {
  clients,
  departments,
  orderStages,
  orders,
  people,
  products,
  roles,
  tenants,
} from '../../server/db/schema'

/**
 * The API's own guarantees, exercised through the real app rather than by
 * reading it.
 *
 * The claim worth testing is the one that looks wrong: the workspace travels in
 * a client-supplied header. That is safe only because capabilities are resolved
 * *inside* the named workspace for the signed-in user, so naming one you do not
 * belong to yields nothing to check against. "Looks like a hole, is not one" is
 * exactly the kind of reasoning that deserves a test rather than a comment.
 */

const ownerUrl = process.env.DATABASE_URL
const appUrl = process.env.APP_DATABASE_URL
const configured = Boolean(ownerUrl && appUrl && process.env.BETTER_AUTH_SECRET)

describe.skipIf(!configured)('the API', () => {
  let owner: Db
  let app: { fetch: (req: Request) => Response | Promise<Response> }
  let keystone: string
  let peach: string
  let cookie: string

  const call = (path: string, tenantId?: string) =>
    app.fetch(
      new Request(`http://localhost${path}`, {
        headers: {
          cookie,
          ...(tenantId ? { 'x-tenant-id': tenantId } : {}),
        },
      }),
    )

  /* Unique per run, and cleaned up on the way in. A fixture with a fixed key
     passes once and then collides, and a failing beforeAll reports as "skipped"
     rather than red — so a stateful fixture can quietly stop testing anything. */
  const ref = `test-isolation-${Date.now()}`

  beforeAll(async () => {
    process.env.VITEST = 'true'
    owner = createDb(ownerUrl!, 2).db
    app = (await import('../../server/index')).default

    const rows = await owner.select({ id: tenants.id, slug: tenants.slug }).from(tenants)
    keystone = rows.find((r) => r.slug === 'ka')!.id
    peach = rows.find((r) => r.slug === 'ps')!.id

    /* Clear anything a previous run left behind, so the suite is re-runnable
       against a database that is not reset between runs. */
    await owner.execute(sql`delete from order_stages where order_id in (select id from orders where ref like 'test-order-%')`)
    await owner.execute(sql`delete from order_events where order_id in (select id from orders where ref like 'test-order-%')`)
    await owner.execute(sql`delete from orders where ref like 'test-order-%'`)
    await owner.execute(sql`delete from people where ref like 'test-isolation%'`)
    await owner.execute(sql`delete from "user" where email like 'isolation-%@example.test'`)

    /* A real sign-up through Better Auth, so the session is one the middleware
       would actually accept rather than one the test forged. */
    const email = `isolation-${Date.now()}@example.test`
    const signUp = await app.fetch(
      new Request('http://localhost/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password: 'correct-horse-battery', name: 'Isolation Test' }),
      }),
    )
    expect(signUp.status, await signUp.clone().text()).toBeLessThan(400)

    const setCookie = signUp.headers.get('set-cookie') ?? ''
    cookie = setCookie.split(',').map((c) => c.split(';')[0].trim()).join('; ')
    expect(cookie, 'no session cookie came back from sign-up').toBeTruthy()

    const [{ id: userId }] = await owner.execute<{ id: string }>(
      sql`select id from "user" where email = ${email}`,
    )

    /* Membership of exactly one workspace — Keystone. Peach State is the one
       this person has no business seeing. */
    await withTenantOn(owner, keystone, async (tx) => {
      const [adminRole] = await tx.select().from(roles).where(eq(roles.key, 'admin')).limit(1)
      await tx.insert(people).values({
        tenantId: keystone,
        userId,
        ref,
        name: 'Isolation Test',
        email,
        roleId: adminRole.id,
        capacity: 0,
      })
    })
  })

  describe('without a session', () => {
    it('refuses', async () => {
      const res = await app.fetch(new Request('http://localhost/api/me'))
      expect(res.status).toBe(401)
    })

    it('still answers the health check, because that is what it is for', async () => {
      const res = await app.fetch(new Request('http://localhost/api/health'))
      expect(res.status).toBe(200)
      await expect(res.json()).resolves.toEqual({ ok: true })
    })
  })

  describe('inside a workspace they belong to', () => {
    it('says who they are and what they may do', async () => {
      const res = await call('/api/me', keystone)
      expect(res.status).toBe(200)

      const body = (await res.json()) as { capabilities: string[]; tenant: { id: string } }
      expect(body.tenant.id).toBe(keystone)
      /* From role_permissions in the database, not from a claim in the token. */
      expect(body.capabilities).toContain('all')
      expect(body.capabilities).toContain('pricing')
    })

    it('lists the workspaces they are actually in, and only those', async () => {
      const res = await call('/api/memberships', keystone)
      expect(res.status).toBe(200)

      const body = (await res.json()) as { id: string; current: boolean }[]
      expect(body.map((m) => m.id)).toEqual([keystone])
      expect(body.find((m) => m.id === keystone)?.current).toBe(true)
    })

    it('serves the reference data', async () => {
      const res = await call('/api/counties', keystone)
      expect(res.status).toBe(200)
      expect(((await res.json()) as unknown[]).length).toBeGreaterThan(0)
    })
  })

  describe('naming a workspace they do not belong to', () => {
    it('is refused, header or no header', async () => {
      const res = await call('/api/me', peach)
      expect(res.status).toBe(403)
      await expect(res.json()).resolves.toMatchObject({ error: expect.stringContaining('No access') })
    })

    it('is refused on every route, not just the guarded ones', async () => {
      for (const path of ['/api/orders', '/api/counties', '/api/people', '/api/memberships']) {
        const res = await call(path, peach)
        expect(res.status, `${path} let another workspace through`).toBe(403)
      }
    })

    it('leaks nothing in the refusal', async () => {
      const res = await call('/api/me', peach)
      const text = await res.text()
      expect(text).not.toContain('Peach')
      expect(text).not.toContain(peach)
    })
  })

  describe('assigning a stage', () => {
    let searchStageId: string
    let qcStageId: string
    let assignee: string

    beforeAll(async () => {
      await withTenantOn(owner, keystone, async (tx) => {
        const [client] = await tx.select().from(clients).limit(1)
        const [product] = await tx.select().from(products).limit(1)
        const depts = await tx.select().from(departments)
        const search = depts.find((d) => d.name === 'Search')!
        const searchQc = depts.find((d) => d.name === 'Search QC')!

        const [worker] = await tx.select().from(people).where(eq(people.ref, 'pd')).limit(1)
        assignee = worker.id

        const [order] = await tx
          .insert(orders)
          .values({
            tenantId: keystone,
            ref: `test-order-${Date.now()}`,
            clientId: client.id,
            productId: product.id,
            state: 'PA',
            county: 'Cambria',
            property: '1 Test Street',
            dueAt: new Date(Date.now() + 86_400_000),
            fee: '100.00',
          })
          .returning()

        const stages = await tx
          .insert(orderStages)
          .values([
            { tenantId: keystone, orderId: order.id, departmentId: search.id },
            { tenantId: keystone, orderId: order.id, departmentId: searchQc.id },
          ])
          .returning()

        searchStageId = stages.find((s) => s.departmentId === search.id)!.id
        qcStageId = stages.find((s) => s.departmentId === searchQc.id)!.id
      })
    })

    const assign = (orderId: string, stageId: string, assigneeId: string | null) =>
      app.fetch(
        new Request(`http://localhost/api/orders/${orderId}/stages/${stageId}`, {
          method: 'POST',
          headers: { cookie, 'x-tenant-id': keystone, 'content-type': 'application/json' },
          body: JSON.stringify({ assigneeId }),
        }),
      )

    it('places somebody on the search, and records why', async () => {
      /* The role was dropped to staff by an earlier test, so put assign back. */
      await withTenantOn(owner, keystone, async (tx) => {
        const [admin] = await tx.select().from(roles).where(eq(roles.key, 'admin')).limit(1)
        await tx.update(people).set({ roleId: admin.id }).where(eq(people.ref, ref))
      })

      const res = await assign('any', searchStageId, assignee)
      expect(res.status, await res.clone().text()).toBe(200)

      const [row] = await withTenantOn(owner, keystone, (tx) =>
        tx.select().from(orderStages).where(eq(orderStages.id, searchStageId)),
      )
      expect(row.assigneeId).toBe(assignee)
      /* The schema always had a column for the reason; it is now written. */
      expect(row.decision, 'the placement recorded no reason').toBeTruthy()
      expect(row.decision!.length).toBeGreaterThan(0)
    })

    it('refuses to let the same person check their own search', async () => {
      /* Enforced in the engine, in the picker, and here. This is the layer that
         does not trust the other two. */
      const res = await assign('any', qcStageId, assignee)
      expect(res.status).toBe(409)
      await expect(res.json()).resolves.toMatchObject({ error: 'Would be self-review' })

      const [row] = await withTenantOn(owner, keystone, (tx) =>
        tx.select().from(orderStages).where(eq(orderStages.id, qcStageId)),
      )
      expect(row.assigneeId, 'the refused assignment was written anyway').toBeNull()
    })

    it('accepts a different person on the QC', async () => {
      const other = await withTenantOn(owner, keystone, (tx) =>
        tx.select().from(people).where(eq(people.ref, 'ln')).limit(1),
      )
      const res = await assign('any', qcStageId, other[0].id)
      expect(res.status, await res.clone().text()).toBe(200)
    })
  })

  describe('capability guards', () => {
    it('refuses a route the role lacks', async () => {
      /* Drop to a role with no pricing capability and the same session must stop
         seeing invoices — the guard reads the database per request, so this
         takes effect without signing in again. */
      await withTenantOn(owner, keystone, async (tx) => {
        const [staffRole] = await tx.select().from(roles).where(eq(roles.key, 'staff')).limit(1)
        await tx.update(people).set({ roleId: staffRole.id }).where(eq(people.ref, ref))
      })

      const res = await call('/api/invoices', keystone)
      expect(res.status).toBe(403)
      await expect(res.json()).resolves.toMatchObject({
        error: expect.stringContaining('pricing'),
      })
    })

    it('narrows the order register instead of refusing it', async () => {
      /* Someone without "see every order" is not locked out of Orders — they
         see the ones they are on. The register and the API agree about that. */
      const res = await call('/api/orders', keystone)
      expect(res.status).toBe(200)
      expect(Array.isArray(await res.json())).toBe(true)
    })
  })
})

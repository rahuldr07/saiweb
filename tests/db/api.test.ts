import { beforeAll, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
import { createDb, withTenantOn, type Db } from '../../server/db/connect'
import {
  clients,
  departments,
  leaveRequests,
  orderStages,
  orders,
  payRuns,
  payslips,
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
    /* Payslips go with their run; the leave rows are hung on a *seeded* person,
       so nothing cascades them away and they have to be named. */
    await owner.execute(sql`delete from pay_runs where period like 'test-narrowing%'`)
    await owner.execute(sql`delete from leave_requests where reason like 'test-narrowing%'`)
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

  /*
   * The bootstrap. Everything else in this file names a workspace in a header,
   * which is what a client can only do *after* this exchange — and for a while
   * nothing tested the step before it, so nobody noticed that a correct email
   * and password could not get anybody in: `/me` refused without a workspace,
   * and the only place to learn a workspace id refused for the same reason.
   */
  describe('before a workspace has been chosen', () => {
    it('still answers which workspaces they are in', async () => {
      const res = await call('/api/memberships')
      expect(res.status).toBe(200)

      const body = (await res.json()) as { id: string; current: boolean }[]
      expect(body.map((m) => m.id)).toEqual([keystone])
      /* None is current yet — that is the state this call exists to end. */
      expect(body.every((m) => !m.current)).toBe(true)
    })

    it('refuses everything that does need one, rather than guessing', async () => {
      for (const path of ['/api/me', '/api/orders', '/api/counties']) {
        const res = await call(path)
        expect(res.status, `${path} answered without a workspace`).toBe(400)
      }
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
         see the ones they are on. The register and the API agree about that.
         *Which* orders come back is asserted below, where there are fixtures to
         assert it against; what this one pins is that the answer is an answer
         and not a 403, because "narrows" and "refuses" are the two ways this
         route could have gone and only one of them is right. */
      const res = await call('/api/orders', keystone)
      expect(res.status, await res.clone().text()).toBe(200)
    })
  })

  /**
   * Narrowing to the person, not just to the workspace.
   *
   * Row-level security scopes every query to a workspace and stops there — a
   * colleague's payslip is in the same workspace as yours, and Postgres has no
   * opinion about that. What keeps it off your screen is four `where` clauses
   * and one `.filter` in the handlers, all of them ordinary code:
   *
   *   hrms.ts:73    leave     → your own unless you can decide leave
   *   hrms.ts:134   payslips  → your own unless you run payroll
   *   hrms.ts:138   payslips  → published runs only, for the person they are about
   *   production.ts:79   the order register → the orders you are on
   *   production.ts:100  one order          → the same, or 404
   *
   * Every test below asks the same question twice against the same rows — once
   * as staff, once as an admin — because a request that returns nothing proves
   * nothing. The admin run is the counter-example: it shows the row is there to
   * be found, so the staff run's *absence* is the gate working rather than an
   * empty table.
   */
  describe('narrowing to the person', () => {
    const colleagueRef = 'kv'
    const colleagueName = 'Kavitha V'

    let mine: { payslip: string; draft: string; leave: string; order: string; orderRef: string }
    let theirs: { payslip: string; leave: string; order: string; orderRef: string }

    /* The capability guard reads the database per request, so a role change
       takes effect on the next call without signing in again — which is what
       lets one session stand in for two people. */
    const beRole = (key: 'admin' | 'staff') =>
      withTenantOn(owner, keystone, async (tx) => {
        const [role] = await tx.select().from(roles).where(eq(roles.key, key)).limit(1)
        await tx.update(people).set({ roleId: role.id }).where(eq(people.ref, ref))
      })

    const ids = async (res: Response) =>
      ((await res.json()) as { id: string }[]).map((r) => r.id)

    beforeAll(async () => {
      await withTenantOn(owner, keystone, async (tx) => {
        const [me] = await tx.select().from(people).where(eq(people.ref, ref)).limit(1)
        const [them] = await tx.select().from(people).where(eq(people.ref, colleagueRef)).limit(1)
        expect(them, `the seed no longer has a person called ${colleagueRef}`).toBeDefined()
        expect(them.name).toBe(colleagueName)

        /* Two runs, because the published/draft split is its own gate. */
        const runs = await tx
          .insert(payRuns)
          .values([
            { tenantId: keystone, period: 'test-narrowing published', state: 'paid', published: true },
            { tenantId: keystone, period: 'test-narrowing draft', state: 'draft', published: false },
          ])
          .returning()
        const published = runs.find((r) => r.published)!
        const draft = runs.find((r) => !r.published)!

        const slips = await tx
          .insert(payslips)
          .values([
            { tenantId: keystone, payRunId: published.id, personId: me.id, gross: '50000.00', deductions: '5000.00', net: '45000.00' },
            { tenantId: keystone, payRunId: published.id, personId: them.id, gross: '60000.00', deductions: '6000.00', net: '54000.00' },
            { tenantId: keystone, payRunId: draft.id, personId: me.id, gross: '51000.00', deductions: '5100.00', net: '45900.00' },
          ])
          .returning()
        const slipFor = (personId: string, payRunId: string) =>
          slips.find((s) => s.personId === personId && s.payRunId === payRunId)!.id

        const leave = await tx
          .insert(leaveRequests)
          .values([
            { tenantId: keystone, personId: me.id, kind: 'pl', fromDate: '2026-07-06', toDate: '2026-07-07', days: '2.0', reason: 'test-narrowing mine' },
            { tenantId: keystone, personId: them.id, kind: 'cl', fromDate: '2026-07-08', toDate: '2026-07-08', days: '1.0', reason: 'test-narrowing theirs' },
          ])
          .returning()

        const [client] = await tx.select().from(clients).limit(1)
        const [product] = await tx.select().from(products).limit(1)
        const [search] = await tx.select().from(departments).where(eq(departments.name, 'Search')).limit(1)

        const stamp = Date.now()
        const refs = { mine: `test-order-mine-${stamp}`, theirs: `test-order-theirs-${stamp}` }
        const both = await tx
          .insert(orders)
          .values(
            [refs.mine, refs.theirs].map((r) => ({
              tenantId: keystone,
              ref: r,
              clientId: client.id,
              productId: product.id,
              state: 'PA',
              county: 'Cambria',
              property: '2 Narrowing Lane',
              dueAt: new Date(stamp + 86_400_000),
              fee: '250.00',
            })),
          )
          .returning()
        const orderFor = (r: string) => both.find((o) => o.ref === r)!

        /* One stage each. Being on a stage of an order is the whole of what
           "your order" means to this API — there is no other column for it. */
        await tx.insert(orderStages).values([
          { tenantId: keystone, orderId: orderFor(refs.mine).id, departmentId: search.id, assigneeId: me.id },
          { tenantId: keystone, orderId: orderFor(refs.theirs).id, departmentId: search.id, assigneeId: them.id },
        ])

        mine = {
          payslip: slipFor(me.id, published.id),
          draft: slipFor(me.id, draft.id),
          leave: leave.find((l) => l.personId === me.id)!.id,
          order: orderFor(refs.mine).id,
          orderRef: refs.mine,
        }
        theirs = {
          payslip: slipFor(them.id, published.id),
          leave: leave.find((l) => l.personId === them.id)!.id,
          order: orderFor(refs.theirs).id,
          orderRef: refs.theirs,
        }
      })
    })

    describe('payslips', () => {
      it('gives a person their own and not their colleague’s', async () => {
        await beRole('staff') // no "pricing"
        const res = await call('/api/hr/payslips', keystone)
        expect(res.status, await res.clone().text()).toBe(200)

        const body = (await res.json()) as { id: string; person: string }[]
        expect(body.map((r) => r.id)).toContain(mine.payslip)
        expect(
          body.map((r) => r.id),
          `${colleagueName}'s payslip was served to somebody else`,
        ).not.toContain(theirs.payslip)
        /* Not one row about anybody else, named or otherwise. */
        expect(body.every((r) => r.person === 'Isolation Test')).toBe(true)
      })

      it('and hands the same row to payroll, which is what makes that a gate', async () => {
        await beRole('admin') // holds "pricing"
        const seen = await ids(await call('/api/hr/payslips', keystone))
        expect(seen, 'the counter-example no longer reproduces').toContain(theirs.payslip)
        expect(seen).toContain(mine.payslip)
      })

      it('keeps an unpublished run off the screen of the person it is about', async () => {
        await beRole('staff')
        const seen = await ids(await call('/api/hr/payslips', keystone))
        expect(seen).toContain(mine.payslip)
        expect(seen, 'a draft run was shown to the person it is about').not.toContain(mine.draft)
      })

      it('while payroll sees the draft, because that is what a draft is for', async () => {
        await beRole('admin')
        const seen = await ids(await call('/api/hr/payslips', keystone))
        expect(seen, 'the counter-example no longer reproduces').toContain(mine.draft)
      })
    })

    describe('leave', () => {
      it('gives a person their own and not their colleague’s', async () => {
        await beRole('staff') // no "people"
        const res = await call('/api/hr/leave', keystone)
        expect(res.status, await res.clone().text()).toBe(200)

        const body = (await res.json()) as { id: string; person: string }[]
        expect(body.map((r) => r.id)).toContain(mine.leave)
        expect(
          body.map((r) => r.id),
          `${colleagueName}'s leave was served to somebody who cannot decide it`,
        ).not.toContain(theirs.leave)
        expect(body.every((r) => r.person === 'Isolation Test')).toBe(true)
      })

      it('and shows an approver both, which is what makes that a gate', async () => {
        await beRole('admin') // holds "people"
        const seen = await ids(await call('/api/hr/leave', keystone))
        expect(seen, 'the counter-example no longer reproduces').toContain(theirs.leave)
        expect(seen).toContain(mine.leave)
      })
    })

    describe('the order register', () => {
      const refsIn = async (res: Response) =>
        ((await res.json()) as { ref: string }[]).map((r) => r.ref)

      it('lists the orders they are on, and not the ones they are not', async () => {
        await beRole('staff') // no "all"
        const res = await call('/api/orders', keystone)
        expect(res.status, await res.clone().text()).toBe(200)

        const seen = await refsIn(res)
        expect(seen).toContain(mine.orderRef)
        expect(seen, `an order only ${colleagueName} is on was in someone else's register`).not.toContain(
          theirs.orderRef,
        )
      })

      it('and lists both for a lead, which is what makes that a gate', async () => {
        await beRole('admin') // holds "all"
        const seen = await refsIn(await call('/api/orders', keystone))
        expect(seen, 'the counter-example no longer reproduces').toContain(theirs.orderRef)
        expect(seen).toContain(mine.orderRef)
      })
    })

    describe('one order by id', () => {
      it('opens the one they are on', async () => {
        await beRole('staff')
        const res = await call(`/api/orders/${mine.order}`, keystone)
        expect(res.status, await res.clone().text()).toBe(200)
        expect(((await res.json()) as { order: { ref: string } }).order.ref).toBe(mine.orderRef)
      })

      it('answers 404 for one they are not, rather than to anybody holding the id', async () => {
        /* The register hiding a row is not the protection. Someone who reads an
           id out of a link, a report or a stale tab arrives here directly. */
        await beRole('staff')
        const res = await call(`/api/orders/${theirs.order}`, keystone)
        expect(res.status, `the detail route handed over ${colleagueName}'s order`).toBe(404)
      })

      it('and opens it for a lead, so the 404 was a refusal and not a missing row', async () => {
        await beRole('admin')
        const res = await call(`/api/orders/${theirs.order}`, keystone)
        expect(res.status, 'the counter-example no longer reproduces').toBe(200)
        expect(((await res.json()) as { order: { ref: string } }).order.ref).toBe(theirs.orderRef)
      })
    })
  })
})

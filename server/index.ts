import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { createMiddleware } from 'hono/factory'
import { cors } from 'hono/cors'
import { and, desc, eq } from 'drizzle-orm'
import { auth } from './auth'
import { assertServerRoleIsSafe, withTenant } from './db/client'
import {
  clients,
  counties,
  countyLinks,
  departments,
  invoices,
  orders,
  orderStages,
  people,
  products,
  rolePermissions,
  roles,
  tenants,
} from './db/schema'

/**
 * The API the front end talks to. Two rules run through all of it:
 *
 *  - Nothing touches the database outside `withTenant`, so every query is scoped
 *    by row-level security rather than by remembering a WHERE clause.
 *  - Capabilities are checked against our own tables, never against a claim in
 *    the token.
 */

type Ctx = {
  Variables: {
    userId: string
    tenantId: string
    capabilities: Set<string>
  }
}

const app = new Hono<Ctx>()

app.use(
  '*',
  cors({
    origin: process.env.APP_URL ?? 'http://localhost:5173',
    credentials: true,
  }),
)

/* Better Auth mounts its own routes. */
app.on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))

app.get('/api/health', (c) => c.json({ ok: true }))

/** Resolves the session, the active workspace, and what this person may do in it. */
app.use('/api/*', async (c, next) => {
  if (c.req.path.startsWith('/api/auth') || c.req.path === '/api/health') return next()

  const s = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!s) return c.json({ error: 'Not signed in' }, 401)

  const tenantId = c.req.header('x-tenant-id') ?? s.session.activeTenantId
  if (!tenantId) return c.json({ error: 'No workspace selected' }, 400)

  const caps = await withTenant(tenantId, async (tx) => {
    const rows = await tx
      .select({ capability: rolePermissions.capability })
      .from(people)
      .innerJoin(roles, eq(roles.id, people.roleId))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .where(and(eq(people.userId, s.user.id), eq(people.active, true)))
    return rows.map((r) => r.capability)
  })

  if (!caps.length) return c.json({ error: 'No access to this workspace' }, 403)

  c.set('userId', s.user.id)
  c.set('tenantId', tenantId)
  c.set('capabilities', new Set(caps))
  return next()
})

/** Guards a route on a capability, the same keys the sidebar filters on. */
const needs = (capability: string) =>
  createMiddleware<Ctx>(async (c, next) => {
    if (!c.get('capabilities').has(capability)) {
      return c.json({ error: `Needs the "${capability}" capability` }, 403)
    }
    return next()
  })

app.get('/api/me', async (c) => {
  const tenantId = c.get('tenantId')
  const userId = c.get('userId')
  const data = await withTenant(tenantId, async (tx) => {
    const [person] = await tx.select().from(people).where(eq(people.userId, userId)).limit(1)
    const [tenant] = await tx.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
    return { person, tenant }
  })
  return c.json({ ...data, capabilities: [...c.get('capabilities')] })
})

app.get('/api/orders', async (c) => {
  const caps = c.get('capabilities')
  const userId = c.get('userId')

  const rows = await withTenant(c.get('tenantId'), async (tx) => {
    const all = await tx
      .select({
        id: orders.id,
        ref: orders.ref,
        status: orders.status,
        state: orders.state,
        county: orders.county,
        property: orders.property,
        dueAt: orders.dueAt,
        receivedAt: orders.receivedAt,
        fee: orders.fee,
        holdReason: orders.holdReason,
        client: clients.code,
        product: products.code,
      })
      .from(orders)
      .innerJoin(clients, eq(clients.id, orders.clientId))
      .innerJoin(products, eq(products.id, orders.productId))
      .orderBy(desc(orders.dueAt))

    /* Someone without "see every order" gets only the orders they are on. */
    if (caps.has('all')) return all
    const [me] = await tx.select({ id: people.id }).from(people).where(eq(people.userId, userId)).limit(1)
    if (!me) return []
    const mine = await tx
      .select({ orderId: orderStages.orderId })
      .from(orderStages)
      .where(eq(orderStages.assigneeId, me.id))
    const ids = new Set(mine.map((m) => m.orderId))
    return all.filter((o) => ids.has(o.id))
  })

  return c.json(rows)
})

app.get('/api/orders/:id', async (c) => {
  const id = c.req.param('id')
  const data = await withTenant(c.get('tenantId'), async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, id)).limit(1)
    if (!order) return null
    const stages = await tx
      .select({
        id: orderStages.id,
        department: departments.name,
        assigneeId: orderStages.assigneeId,
        startedAt: orderStages.startedAt,
        finishedAt: orderStages.finishedAt,
      })
      .from(orderStages)
      .innerJoin(departments, eq(departments.id, orderStages.departmentId))
      .where(eq(orderStages.orderId, id))
      .orderBy(departments.position)
    return { order, stages }
  })
  return data ? c.json(data) : c.json({ error: 'Not found' }, 404)
})

/** Assign one stage. The self-review rule is enforced here as well as in the engine. */
app.post('/api/orders/:id/stages/:stageId', needs('assign'), async (c) => {
  const { stageId } = c.req.param()
  const body = (await c.req.json()) as { assigneeId: string | null }

  const result = await withTenant(c.get('tenantId'), async (tx) => {
    const [stage] = await tx.select().from(orderStages).where(eq(orderStages.id, stageId)).limit(1)
    if (!stage) return { error: 'Not found' as const }

    const [dept] = await tx
      .select()
      .from(departments)
      .where(eq(departments.id, stage.departmentId))
      .limit(1)

    if (body.assigneeId && dept?.pairs) {
      const [paired] = await tx
        .select({ assigneeId: orderStages.assigneeId })
        .from(orderStages)
        .innerJoin(departments, eq(departments.id, orderStages.departmentId))
        .where(and(eq(orderStages.orderId, stage.orderId), eq(departments.name, dept.pairs)))
        .limit(1)
      if (paired?.assigneeId === body.assigneeId) {
        return { error: 'Would be self-review' as const }
      }
    }

    await tx
      .update(orderStages)
      .set({ assigneeId: body.assigneeId })
      .where(eq(orderStages.id, stageId))
    return { ok: true as const }
  })

  if ('error' in result) return c.json(result, result.error === 'Not found' ? 404 : 409)
  return c.json(result)
})

app.get('/api/people', async (c) => {
  const rows = await withTenant(c.get('tenantId'), (tx) =>
    tx.select().from(people).where(eq(people.active, true)),
  )
  return c.json(rows)
})

app.get('/api/clients', needs('pricing'), async (c) => {
  const rows = await withTenant(c.get('tenantId'), (tx) => tx.select().from(clients))
  return c.json(rows)
})

app.get('/api/products', async (c) => {
  const rows = await withTenant(c.get('tenantId'), (tx) => tx.select().from(products))
  return c.json(rows)
})

app.get('/api/invoices', needs('pricing'), async (c) => {
  const rows = await withTenant(c.get('tenantId'), (tx) =>
    tx.select().from(invoices).orderBy(desc(invoices.issuedAt)),
  )
  return c.json(rows)
})

app.get('/api/counties', async (c) => {
  const rows = await withTenant(c.get('tenantId'), async (tx) => {
    const cs = await tx.select().from(counties).orderBy(counties.state, counties.name)
    const links = await tx.select().from(countyLinks)
    return cs.map((county) => ({
      ...county,
      links: links.filter((l) => l.countyId === county.id),
    }))
  })
  return c.json(rows)
})

const port = Number(process.env.PORT ?? 8787)

/**
 * Check the connection before accepting a single request. If this role can
 * bypass row-level security, every policy silently stops applying and the
 * server looks entirely healthy — so the only safe response is to not start.
 */
assertServerRoleIsSafe()
  .then(() => {
    serve({ fetch: app.fetch, port }, (info) => {
      console.log(`API listening on http://localhost:${info.port}`)
    })
  })
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e)
    process.exit(1)
  })

export default app

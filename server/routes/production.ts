import { Hono } from 'hono'
import { and, asc, desc, eq } from 'drizzle-orm'
import { withTenant } from '../db/client'
import {
  clients,
  departments,
  orderEvents,
  orderStages,
  orders,
  people,
  products,
} from '../db/schema'
import { needs, type Ctx } from '../context'

export const productionRoutes = new Hono<Ctx>()

productionRoutes.get('/orders', async (c) => {
  const caps = c.get('capabilities')
  const personId = c.get('personId')

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
        deliveredAt: orders.deliveredAt,
        fee: orders.fee,
        holdReason: orders.holdReason,
        client: clients.code,
        product: products.code,
      })
      .from(orders)
      .innerJoin(clients, eq(clients.id, orders.clientId))
      .innerJoin(products, eq(products.id, orders.productId))
      .orderBy(desc(orders.dueAt))

    /* Someone without "see every order" gets only the orders they are on. The
       register and the API agree about this, which is the point: hiding rows in
       the client would be a presentation choice, not a permission. */
    if (caps.has('all')) return all

    const mine = await tx
      .select({ orderId: orderStages.orderId })
      .from(orderStages)
      .where(eq(orderStages.assigneeId, personId))
    const ids = new Set(mine.map((m) => m.orderId))
    return all.filter((o) => ids.has(o.id))
  })

  return c.json(rows)
})

productionRoutes.get('/orders/:id', async (c) => {
  const id = c.req.param('id')

  const data = await withTenant(c.get('tenantId'), async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, id)).limit(1)
    if (!order) return null

    const stages = await tx
      .select({
        id: orderStages.id,
        department: departments.name,
        pairs: departments.pairs,
        assigneeId: orderStages.assigneeId,
        assignee: people.name,
        startedAt: orderStages.startedAt,
        finishedAt: orderStages.finishedAt,
        decision: orderStages.decision,
      })
      .from(orderStages)
      .innerJoin(departments, eq(departments.id, orderStages.departmentId))
      .leftJoin(people, eq(people.id, orderStages.assigneeId))
      .where(eq(orderStages.orderId, id))
      .orderBy(asc(departments.position))

    const events = await tx
      .select({
        id: orderEvents.id,
        kind: orderEvents.kind,
        body: orderEvents.body,
        at: orderEvents.at,
        actor: people.name,
      })
      .from(orderEvents)
      .leftJoin(people, eq(people.id, orderEvents.actorId))
      .where(eq(orderEvents.orderId, id))
      .orderBy(desc(orderEvents.at))

    return { order, stages, events }
  })

  return data ? c.json(data) : c.json({ error: 'Not found' }, 404)
})

/**
 * Assign one stage.
 *
 * QC independence is re-checked here even though the engine already filters the
 * author out and the picker already hides them. It is the one rule where a bug
 * is a compliance problem rather than a display problem, so the write path does
 * not trust the caller about it.
 */
productionRoutes.post('/orders/:id/stages/:stageId', needs('assign'), async (c) => {
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

      if (paired?.assigneeId && paired.assigneeId === body.assigneeId) {
        return { error: 'Would be self-review' as const }
      }
    }

    /**
     * Record why, not just what.
     *
     * The Assignment screen already explains every automatic placement, and the
     * schema has always had a column for it. Writing the reason down here turns
     * that explanation into an audit record: months later, "who put Ravi on this
     * QC" and "why was nobody else eligible" have an answer that does not depend
     * on re-running an engine whose rules have since changed.
     */
    const decision = [
      {
        rule: 'manual',
        note: body.assigneeId
          ? `Assigned by hand${dept?.name ? ` on ${dept.name}` : ''}`
          : `Cleared by hand${dept?.name ? ` on ${dept.name}` : ''}`,
      },
      ...(dept?.pairs ? [{ rule: 'r4', note: `Checked against the ${dept.pairs} assignee` }] : []),
    ]

    await tx
      .update(orderStages)
      .set({ assigneeId: body.assigneeId, decision })
      .where(eq(orderStages.id, stageId))

    await tx.insert(orderEvents).values({
      tenantId: c.get('tenantId'),
      orderId: stage.orderId,
      actorId: c.get('personId'),
      kind: body.assigneeId ? 'assigned' : 'unassigned',
      body: dept?.name ?? '',
    })

    return { ok: true as const }
  })

  if ('error' in result) return c.json(result, result.error === 'Not found' ? 404 : 409)
  return c.json(result)
})

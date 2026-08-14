import { Hono } from 'hono'
import { asc, eq } from 'drizzle-orm'
import { withTenant } from '../db/client'
import { assignmentRules, departments, products, slaRules, stageBudgets, tenantSettings } from '../db/schema'
import { needs, type Ctx } from '../context'

export const configRoutes = new Hono<Ctx>()

/**
 * What the engine is configured to do — rules, turnaround promises and the share
 * of each promise a stage gets.
 *
 * These are rows rather than constants because the Company screen edits them,
 * and because a rule whose condition is data cannot disagree with the sentence
 * shown next to it.
 */

configRoutes.get('/rules', async (c) => {
  const rows = await withTenant(c.get('tenantId'), (tx) =>
    tx.select().from(assignmentRules).orderBy(asc(assignmentRules.position)),
  )
  return c.json(rows)
})

configRoutes.post('/rules/:id', needs('config'), async (c) => {
  const id = c.req.param('id')
  const body = (await c.req.json()) as { enabled: boolean }

  const result = await withTenant(c.get('tenantId'), async (tx) => {
    const [rule] = await tx.select().from(assignmentRules).where(eq(assignmentRules.id, id)).limit(1)
    if (!rule) return { error: 'Not found' as const }

    /* Some rules are the reason the system can be trusted — department
       membership, self-review, fill-the-emptiest. They may be read and
       inspected, and they may not be switched off. */
    if (rule.locked) return { error: `"${rule.name}" cannot be switched off` as const }

    await tx
      .update(assignmentRules)
      .set({ enabled: body.enabled })
      .where(eq(assignmentRules.id, id))
    return { ok: true as const }
  })

  if ('error' in result) return c.json(result, result.error === 'Not found' ? 404 : 409)
  return c.json(result)
})

configRoutes.get('/sla', async (c) => {
  const rows = await withTenant(c.get('tenantId'), (tx) => tx.select().from(slaRules))
  return c.json(rows)
})

configRoutes.get('/stage-budgets', async (c) => {
  const rows = await withTenant(c.get('tenantId'), (tx) =>
    tx
      .select({
        id: stageBudgets.id,
        productId: stageBudgets.productId,
        product: products.code,
        department: departments.name,
        percent: stageBudgets.percent,
      })
      .from(stageBudgets)
      .innerJoin(departments, eq(departments.id, stageBudgets.departmentId))
      .leftJoin(products, eq(products.id, stageBudgets.productId))
      .orderBy(asc(departments.position)),
  )
  return c.json(rows)
})

configRoutes.get('/settings', async (c) => {
  const tenantId = c.get('tenantId')
  const [row] = await withTenant(tenantId, (tx) =>
    tx.select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId)).limit(1),
  )
  return row ? c.json(row) : c.json({ error: 'Not found' }, 404)
})

configRoutes.post('/settings', needs('config'), async (c) => {
  const tenantId = c.get('tenantId')
  const body = (await c.req.json()) as {
    dateFormat?: string
    slaBufferPct?: number
    onTimeTarget?: number
  }

  if (body.slaBufferPct !== undefined && (body.slaBufferPct < 0 || body.slaBufferPct >= 100)) {
    return c.json({ error: 'The buffer is a percentage of the promise, so it must be under 100' }, 400)
  }

  await withTenant(tenantId, (tx) =>
    tx.update(tenantSettings).set(body).where(eq(tenantSettings.tenantId, tenantId)),
  )
  return c.json({ ok: true })
})

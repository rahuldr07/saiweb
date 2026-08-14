import { Hono } from 'hono'
import { sql } from 'drizzle-orm'
import { eq } from 'drizzle-orm'
import { db, withTenant } from '../db/client'
import { people, tenantSettings, tenants } from '../db/schema'
import type { Ctx } from '../context'

export const sessionRoutes = new Hono<Ctx>()

/**
 * Who you are here, and what you may do. This is the endpoint that makes the
 * database authoritative about permissions: the client used to answer `can()`
 * from a static role table shipped in the bundle, which agreed with the server
 * only because one had been transcribed from the other.
 */
sessionRoutes.get('/me', async (c) => {
  const tenantId = c.get('tenantId')
  const userId = c.get('userId')

  const data = await withTenant(tenantId, async (tx) => {
    const [person] = await tx.select().from(people).where(eq(people.userId, userId)).limit(1)
    const [tenant] = await tx.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1)
    const [settings] = await tx
      .select()
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId))
      .limit(1)
    return { person, tenant, settings }
  })

  return c.json({ ...data, capabilities: [...c.get('capabilities')] })
})

/**
 * Which workspaces this person belongs to.
 *
 * This is the one query that cannot run inside a workspace, and the RLS policy
 * on `tenants` is what makes that true — it admits exactly the row matching the
 * current scope, which is correct for isolation and useless for a switcher.
 *
 * Rather than hand the server a role that bypasses the policies, the exception
 * is a single SECURITY DEFINER function that takes a user id and returns only
 * that user's own memberships. There is no argument that widens it, so the
 * blast radius is one person's own list — see `app_memberships` in rls.sql.
 */
sessionRoutes.get('/memberships', async (c) => {
  const userId = c.get('userId')

  const rows = await db.execute<{
    tenant_id: string
    slug: string
    name: string
    plan: string
    state: string
    person_id: string
  }>(sql`select * from app_memberships(${userId})`)

  return c.json(
    Array.from(rows).map((r) => ({
      id: r.tenant_id,
      slug: r.slug,
      name: r.name,
      plan: r.plan,
      state: r.state,
      personId: r.person_id,
      current: r.tenant_id === c.get('tenantId'),
    })),
  )
})

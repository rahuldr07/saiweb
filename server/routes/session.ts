import { Hono } from 'hono'
import { sql } from 'drizzle-orm'
import { eq } from 'drizzle-orm'
import { db, withTenant } from '../db/client'
import { people, tenantSettings, tenants } from '../db/schema'
import type { Ctx, SessionCtx } from '../context'

export const sessionRoutes = new Hono<Ctx>()

/**
 * The routes that answer before a workspace has been chosen.
 *
 * Mounted ahead of `requireWorkspace`, because this is the one thing a client
 * needs to know before it can name a workspace at all.
 */
export const preflightRoutes = new Hono<SessionCtx>()

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
preflightRoutes.get('/memberships', async (c) => {
  const userId = c.get('userId')

  const rows = await db.execute<{
    tenant_id: string
    slug: string
    name: string
    plan: string
    state: string
    person_id: string
  }>(sql`select * from app_memberships(${userId})`)

  const list = Array.from(rows)

  /*
   * This route does not need a workspace — it is what you call to find one. But
   * naming one you are not a member of is still a bogus request, and refusing it
   * everywhere is a rule worth being able to state without exceptions. The list
   * just fetched is the authority, so this costs no extra query.
   */
  const named = c.req.header('x-tenant-id')
  if (named && !list.some((r) => r.tenant_id === named)) {
    return c.json({ error: 'No access to this workspace' }, 403)
  }

  return c.json(
    list.map((r) => ({
      id: r.tenant_id,
      slug: r.slug,
      name: r.name,
      plan: r.plan,
      state: r.state,
      personId: r.person_id,
      /* Which one the caller is already in, if any — the header when they have
         named one, the session's own choice otherwise, and none of them before
         either exists. */
      current: r.tenant_id === (c.req.header('x-tenant-id') ?? c.get('activeTenantId')),
    })),
  )
})

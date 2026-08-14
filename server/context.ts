import { createMiddleware } from 'hono/factory'
import { and, eq } from 'drizzle-orm'
import { auth } from './auth'
import { withTenant } from './db/client'
import { people, rolePermissions, roles } from './db/schema'

/**
 * Who is asking, which workspace they are asking about, and what they may do in
 * it. Everything else in the API is written on the assumption that this has
 * already run.
 */
export type Ctx = {
  Variables: {
    userId: string
    tenantId: string
    /** The person row for this user *in this workspace*. */
    personId: string
    capabilities: Set<string>
  }
}

/**
 * Resolves the session, the active workspace, and the capabilities.
 *
 * The workspace can be named by a header, which looks like a hole and is not:
 * capabilities are resolved *inside* the requested workspace for the signed-in
 * user, so naming a workspace you are not in yields an empty set and a 403
 * before any handler runs. Membership is the check; the header only selects.
 */
export const authenticate = createMiddleware<Ctx>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'Not signed in' }, 401)

  const tenantId = c.req.header('x-tenant-id') ?? session.session.activeTenantId
  if (!tenantId) return c.json({ error: 'No workspace selected' }, 400)

  const found = await withTenant(tenantId, async (tx) => {
    const rows = await tx
      .select({ personId: people.id, capability: rolePermissions.capability })
      .from(people)
      .innerJoin(roles, eq(roles.id, people.roleId))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .where(and(eq(people.userId, session.user.id), eq(people.active, true)))
    return rows
  })

  if (!found.length) return c.json({ error: 'No access to this workspace' }, 403)

  c.set('userId', session.user.id)
  c.set('tenantId', tenantId)
  c.set('personId', found[0].personId)
  c.set('capabilities', new Set(found.map((r) => r.capability)))
  return next()
})

/**
 * Guards a route on a capability — the same keys the sidebar filters on, so a
 * hidden nav item and a refused request cannot disagree about what a role means.
 */
export const needs = (capability: string) =>
  createMiddleware<Ctx>(async (c, next) => {
    if (!c.get('capabilities').has(capability)) {
      return c.json({ error: `Needs the "${capability}" capability` }, 403)
    }
    return next()
  })

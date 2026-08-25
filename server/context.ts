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
export type SessionCtx = {
  Variables: {
    userId: string
    /** The workspace the session last settled on, if it ever did. */
    activeTenantId: string | null
  }
}

export type Ctx = {
  Variables: SessionCtx['Variables'] & {
    tenantId: string
    /** The person row for this user *in this workspace*. */
    personId: string
    capabilities: Set<string>
  }
}

/**
 * Signed in, and nothing more.
 *
 * This is deliberately separate from the workspace check below, because there is
 * one question a client has to be able to ask before it is inside a workspace:
 * which workspaces am I in? Requiring a workspace to ask that is a deadlock —
 * the only place a client can learn a workspace id is the answer it cannot get.
 * Everything else goes through `requireWorkspace` as well as this.
 */
export const requireSession = createMiddleware<SessionCtx>(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!session) return c.json({ error: 'Not signed in' }, 401)

  c.set('userId', session.user.id)
  c.set('activeTenantId', session.session.activeTenantId ?? null)
  return next()
})

/**
 * Inside a workspace they belong to, with the capabilities they hold there.
 *
 * The workspace can be named by a header, which looks like a hole and is not:
 * capabilities are resolved *inside* the requested workspace for the signed-in
 * user, so naming a workspace you are not in yields an empty set and a 403
 * before any handler runs. Membership is the check; the header only selects.
 *
 * Runs after `requireSession`, which is what put the user on the context.
 */
export const requireWorkspace = createMiddleware<Ctx>(async (c, next) => {
  const userId = c.get('userId')
  const tenantId = c.req.header('x-tenant-id') ?? c.get('activeTenantId')
  if (!tenantId) return c.json({ error: 'No workspace selected' }, 400)

  const found = await withTenant(tenantId, async (tx) => {
    const rows = await tx
      .select({ personId: people.id, capability: rolePermissions.capability })
      .from(people)
      .innerJoin(roles, eq(roles.id, people.roleId))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, roles.id))
      .where(and(eq(people.userId, userId), eq(people.active, true)))
    return rows
  })

  if (!found.length) return c.json({ error: 'No access to this workspace' }, 403)

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

import { Hono } from 'hono'
import { asc, eq } from 'drizzle-orm'
import { withTenant } from '../db/client'
import {
  counties,
  countyLinks,
  departments,
  levels,
  people,
  peopleDepartments,
  products,
  roles,
} from '../db/schema'
import type { Ctx } from '../context'

export const referenceRoutes = new Hono<Ctx>()

/** The roster, with the departments each person belongs to. */
referenceRoutes.get('/people', async (c) => {
  const rows = await withTenant(c.get('tenantId'), async (tx) => {
    const staff = await tx
      .select({
        id: people.id,
        ref: people.ref,
        name: people.name,
        email: people.email,
        capacity: people.capacity,
        availability: people.availability,
        shift: people.shift,
        active: people.active,
        levelId: people.levelId,
        joinedOn: people.joinedOn,
        role: roles.key,
        roleName: roles.name,
      })
      .from(people)
      .leftJoin(roles, eq(roles.id, people.roleId))
      .where(eq(people.active, true))
      .orderBy(asc(people.name))

    const membership = await tx
      .select({ personId: peopleDepartments.personId, department: departments.name })
      .from(peopleDepartments)
      .innerJoin(departments, eq(departments.id, peopleDepartments.departmentId))

    return staff.map((s) => ({
      ...s,
      departments: membership.filter((m) => m.personId === s.id).map((m) => m.department),
    }))
  })

  return c.json(rows)
})

referenceRoutes.get('/departments', async (c) => {
  const rows = await withTenant(c.get('tenantId'), (tx) =>
    tx.select().from(departments).orderBy(asc(departments.position)),
  )
  return c.json(rows)
})

referenceRoutes.get('/roles', async (c) => {
  const rows = await withTenant(c.get('tenantId'), (tx) =>
    tx.select().from(roles).orderBy(asc(roles.name)),
  )
  return c.json(rows)
})

referenceRoutes.get('/levels', async (c) => {
  const rows = await withTenant(c.get('tenantId'), (tx) => tx.select().from(levels))
  return c.json(rows)
})

referenceRoutes.get('/products', async (c) => {
  const rows = await withTenant(c.get('tenantId'), (tx) =>
    tx.select().from(products).orderBy(asc(products.code)),
  )
  return c.json(rows)
})

/** Counties with their recorder links, which is how the coverage screens read. */
referenceRoutes.get('/counties', async (c) => {
  const rows = await withTenant(c.get('tenantId'), async (tx) => {
    const cs = await tx.select().from(counties).orderBy(asc(counties.state), asc(counties.name))
    const links = await tx.select().from(countyLinks)
    return cs.map((county) => ({
      ...county,
      links: links.filter((l) => l.countyId === county.id),
    }))
  })
  return c.json(rows)
})

/** Just the links, for the monitor — it groups by status rather than by county. */
referenceRoutes.get('/links', async (c) => {
  const rows = await withTenant(c.get('tenantId'), (tx) =>
    tx
      .select({
        id: countyLinks.id,
        kind: countyLinks.kind,
        url: countyLinks.url,
        status: countyLinks.status,
        error: countyLinks.error,
        checkedAt: countyLinks.checkedAt,
        county: counties.name,
        state: counties.state,
      })
      .from(countyLinks)
      .innerJoin(counties, eq(counties.id, countyLinks.countyId))
      .orderBy(asc(counties.state), asc(counties.name)),
  )
  return c.json(rows)
})

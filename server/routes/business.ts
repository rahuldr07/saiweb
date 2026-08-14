import { Hono } from 'hono'
import { asc, desc, eq } from 'drizzle-orm'
import { withTenant } from '../db/client'
import { clients, invoices, leadNotes, leads, people } from '../db/schema'
import { needs, type Ctx } from '../context'

export const businessRoutes = new Hono<Ctx>()

/**
 * Clients, invoicing and the lead pipeline. All of it sits behind `pricing`:
 * what a client is charged is not something the production floor needs, and the
 * sidebar hides these for the same reason.
 */

businessRoutes.get('/clients', needs('pricing'), async (c) => {
  const rows = await withTenant(c.get('tenantId'), (tx) =>
    tx.select().from(clients).orderBy(asc(clients.code)),
  )
  return c.json(rows)
})

businessRoutes.get('/invoices', needs('pricing'), async (c) => {
  const rows = await withTenant(c.get('tenantId'), (tx) =>
    tx
      .select({
        id: invoices.id,
        number: invoices.number,
        period: invoices.period,
        orderCount: invoices.orderCount,
        amount: invoices.amount,
        paid: invoices.paid,
        status: invoices.status,
        issuedAt: invoices.issuedAt,
        client: clients.code,
        clientName: clients.name,
        terms: clients.terms,
      })
      .from(invoices)
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .orderBy(desc(invoices.issuedAt)),
  )
  return c.json(rows)
})

businessRoutes.get('/leads', needs('pricing'), async (c) => {
  const rows = await withTenant(c.get('tenantId'), async (tx) => {
    const all = await tx
      .select({
        id: leads.id,
        company: leads.company,
        location: leads.location,
        status: leads.status,
        flagged: leads.flagged,
        contacts: leads.contacts,
        createdAt: leads.createdAt,
        owner: people.name,
      })
      .from(leads)
      .leftJoin(people, eq(people.id, leads.ownerId))
      .orderBy(desc(leads.createdAt))

    const notes = await tx
      .select({
        id: leadNotes.id,
        leadId: leadNotes.leadId,
        body: leadNotes.body,
        at: leadNotes.at,
        author: people.name,
      })
      .from(leadNotes)
      .leftJoin(people, eq(people.id, leadNotes.authorId))
      .orderBy(desc(leadNotes.at))

    /* Staleness is derived from the notes rather than stored, so a lead nobody
       has touched cannot quietly look fresh. */
    return all.map((l) => {
      const mine = notes.filter((n) => n.leadId === l.id)
      return { ...l, notes: mine, lastTouchedAt: mine[0]?.at ?? l.createdAt }
    })
  })
  return c.json(rows)
})

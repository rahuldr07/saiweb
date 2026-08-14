import { Hono } from 'hono'
import { asc, desc, eq } from 'drizzle-orm'
import { withTenant } from '../db/client'
import {
  attendance,
  candidates,
  leaveRequests,
  openings,
  payRuns,
  payslips,
  people,
  pettyCash,
} from '../db/schema'
import { needs, type Ctx } from '../context'

export const hrmsRoutes = new Hono<Ctx>()

/**
 * The HRMS group. Two capabilities separate the personal views from the company
 * ones, and they are the inverse of each other on purpose: somebody who runs
 * payroll uses the run, not their own payslip screen.
 *
 * Where a route serves both, it narrows to the caller rather than refusing — a
 * person may always see their own leave and their own payslips.
 */

hrmsRoutes.get('/attendance', needs('all'), async (c) => {
  const period = c.req.query('period')
  const rows = await withTenant(c.get('tenantId'), (tx) => {
    const q = tx
      .select({
        id: attendance.id,
        personId: attendance.personId,
        person: people.name,
        period: attendance.period,
        workingDays: attendance.workingDays,
        present: attendance.present,
        paidLeave: attendance.paidLeave,
        unpaid: attendance.unpaid,
        payableDays: attendance.payableDays,
      })
      .from(attendance)
      .innerJoin(people, eq(people.id, attendance.personId))
      .orderBy(asc(people.name))
    return period ? q.where(eq(attendance.period, period)) : q
  })
  return c.json(rows)
})

/** Everyone's leave for an approver; your own otherwise. */
hrmsRoutes.get('/leave', async (c) => {
  const mine = !c.get('capabilities').has('people')
  const personId = c.get('personId')

  const rows = await withTenant(c.get('tenantId'), (tx) => {
    const q = tx
      .select({
        id: leaveRequests.id,
        personId: leaveRequests.personId,
        person: people.name,
        kind: leaveRequests.kind,
        fromDate: leaveRequests.fromDate,
        toDate: leaveRequests.toDate,
        days: leaveRequests.days,
        status: leaveRequests.status,
        reason: leaveRequests.reason,
        decidedAt: leaveRequests.decidedAt,
      })
      .from(leaveRequests)
      .innerJoin(people, eq(people.id, leaveRequests.personId))
      .orderBy(desc(leaveRequests.fromDate))
    return mine ? q.where(eq(leaveRequests.personId, personId)) : q
  })
  return c.json(rows)
})

hrmsRoutes.post('/leave/:id/decision', needs('people'), async (c) => {
  const id = c.req.param('id')
  const body = (await c.req.json()) as { status: 'approved' | 'rejected' }

  if (body.status !== 'approved' && body.status !== 'rejected') {
    return c.json({ error: 'A decision is either approved or rejected' }, 400)
  }

  const result = await withTenant(c.get('tenantId'), async (tx) => {
    const [row] = await tx.select().from(leaveRequests).where(eq(leaveRequests.id, id)).limit(1)
    if (!row) return { error: 'Not found' as const }

    /* Deciding your own leave is the same shape of problem as reviewing your own
       search: the check is not a check if the author performs it. */
    if (row.personId === c.get('personId')) {
      return { error: 'You cannot decide your own leave' as const }
    }

    await tx
      .update(leaveRequests)
      .set({ status: body.status, decidedById: c.get('personId'), decidedAt: new Date() })
      .where(eq(leaveRequests.id, id))
    return { ok: true as const }
  })

  if ('error' in result) return c.json(result, result.error === 'Not found' ? 404 : 409)
  return c.json(result)
})

hrmsRoutes.get('/payruns', needs('pricing'), async (c) => {
  const rows = await withTenant(c.get('tenantId'), (tx) =>
    tx.select().from(payRuns).orderBy(desc(payRuns.period)),
  )
  return c.json(rows)
})

/** The run's payslips for payroll staff; your own otherwise. */
hrmsRoutes.get('/payslips', async (c) => {
  const mine = !c.get('capabilities').has('pricing')
  const personId = c.get('personId')

  const rows = await withTenant(c.get('tenantId'), (tx) => {
    const q = tx
      .select({
        id: payslips.id,
        payRunId: payslips.payRunId,
        personId: payslips.personId,
        person: people.name,
        period: payRuns.period,
        published: payRuns.published,
        gross: payslips.gross,
        deductions: payslips.deductions,
        net: payslips.net,
        lines: payslips.lines,
      })
      .from(payslips)
      .innerJoin(people, eq(people.id, payslips.personId))
      .innerJoin(payRuns, eq(payRuns.id, payslips.payRunId))
      .orderBy(desc(payRuns.period))
    return mine ? q.where(eq(payslips.personId, personId)) : q
  })

  /* An unpublished run is a draft: payroll can see it, the person cannot. */
  return c.json(mine ? rows.filter((r) => r.published) : rows)
})

hrmsRoutes.get('/petty-cash', needs('pricing'), async (c) => {
  const rows = await withTenant(c.get('tenantId'), (tx) =>
    tx
      .select({
        id: pettyCash.id,
        at: pettyCash.at,
        kind: pettyCash.kind,
        description: pettyCash.description,
        amount: pettyCash.amount,
        reference: pettyCash.reference,
        hasReceipt: pettyCash.hasReceipt,
        recordedBy: people.name,
      })
      .from(pettyCash)
      .leftJoin(people, eq(people.id, pettyCash.recordedById))
      .orderBy(desc(pettyCash.at)),
  )
  return c.json(rows)
})

hrmsRoutes.get('/openings', needs('people'), async (c) => {
  const rows = await withTenant(c.get('tenantId'), async (tx) => {
    const jobs = await tx.select().from(openings).orderBy(desc(openings.openedAt))
    const applicants = await tx.select().from(candidates)
    return jobs.map((j) => ({
      ...j,
      candidates: applicants.filter((a) => a.openingId === j.id),
    }))
  })
  return c.json(rows)
})

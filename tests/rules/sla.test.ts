import { describe, expect, it } from 'vitest'
import { budgetOK, checkpoints, orderPlan, shareTotal, sharesFor, slaHours, hh } from '@/lib/sla'
import { BUDGET } from '@/data/budget'
import { ASSIGN_STAGES } from '@/data/org'
import { PRODUCTS } from '@/data/catalog'
import { ORDERS } from '@/data/production'

/**
 * The promise to the client, and the internal checkpoints that keep an order on
 * course for it. The property that matters: the checkpoints must always fit
 * inside the promise with the buffer still unspent, or "on track" means nothing.
 */

describe('stage budgets', () => {
  it('divides exactly 100% of the window, for the base and every override', () => {
    expect(budgetOK(BUDGET.base), 'the base shares do not sum to 100').toBe(true)
    BUDGET.over.forEach((o) => {
      expect(budgetOK(o.shares), `the ${o.pr} override does not sum to 100`).toBe(true)
    })
  })

  it('gives every automatic stage a share', () => {
    ASSIGN_STAGES.forEach((st) => {
      expect(BUDGET.base[st], `${st} has no share of the budget`).toBeGreaterThan(0)
    })
  })

  it('resolves a share set for every product in the catalogue', () => {
    PRODUCTS.forEach((p) => {
      expect(Math.round(shareTotal(sharesFor(p.id))), `${p.id} resolves to a broken budget`).toBe(100)
    })
  })

  it('holds the buffer back rather than dividing it', () => {
    expect(BUDGET.buffer).toBeGreaterThan(0)
    expect(BUDGET.buffer).toBeLessThan(100)

    /* The checkpoints are laid out across the window *after* the buffer, so the
       last one must land before the client deadline with the buffer to spare. */
    const cps = checkpoints(24, 'COS')
    const last = cps[cps.length - 1]
    expect(last.by).toBeCloseTo(24 * (1 - BUDGET.buffer / 100), 5)
    expect(last.by).toBeLessThan(24)
  })
})

describe('checkpoints', () => {
  it('runs in stage order and never goes backwards', () => {
    PRODUCTS.forEach((p) => {
      const cps = checkpoints(slaHours({ cl: 'MGR', pr: p.id }), p.id)
      expect(cps.map((c) => c.stage)).toEqual(ASSIGN_STAGES)
      cps.forEach((c, i) => {
        expect(c.hours, `${p.id}/${c.stage} has no time budgeted`).toBeGreaterThan(0)
        if (i > 0) expect(c.by).toBeGreaterThan(cps[i - 1].by)
      })
    })
  })

  it('scales with the promise', () => {
    const short = checkpoints(24, 'COS')
    const long = checkpoints(48, 'COS')
    short.forEach((c, i) => expect(long[i].by).toBeCloseTo(c.by * 2, 5))
  })
})

describe('SLA resolution', () => {
  it('falls through client+product, then client, then default', () => {
    /* The specific override wins; anything unmatched still gets an answer. */
    expect(slaHours({ cl: 'CSS', pr: 'COS' })).toBe(48)
    expect(slaHours({ cl: 'MGR', pr: 'LIEN' })).toBe(24)
    expect(slaHours({ cl: 'nobody', pr: 'nothing' })).toBe(24)
  })

  it('always resolves to a positive number of hours', () => {
    ORDERS.forEach((o) => {
      expect(slaHours(o), `${o.id} resolved to a non-positive SLA`).toBeGreaterThan(0)
    })
  })
})

describe('order plans', () => {
  it('never claims an order is both finished and out of time', () => {
    ORDERS.forEach((o) => {
      const plan = orderPlan(o)
      if (o.done) expect(plan.doomed, `${o.id} is delivered but flagged doomed`).toBe(false)
    })
  })

  it('marks an order doomed exactly when the work left outruns the clock left', () => {
    ORDERS.filter((o) => !o.done).forEach((o) => {
      const plan = orderPlan(o)
      expect(plan.doomed).toBe(plan.needs > plan.remaining)
    })
  })

  it('produces one row per stage, in order', () => {
    ORDERS.forEach((o) => {
      expect(orderPlan(o).rows.map((r) => r.stage)).toEqual(ASSIGN_STAGES)
    })
  })
})

describe('hour formatting', () => {
  it('switches to minutes under an hour, the way the design does', () => {
    expect(hh(2.5)).toBe('2.5h')
    expect(hh(1)).toBe('1h')
    expect(hh(0.6667)).toBe('40m')
  })
})

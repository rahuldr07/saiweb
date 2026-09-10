import { afterEach, describe, expect, it } from 'vitest'
import { SEED_NOW, now, resetClock, setClock } from '@/lib/clock'
import { SOON_HOURS, dueMeta, orderChipKind, orderState, type OrderState } from '@/lib/format'
import { ORDERS } from '@/data/production'
import { atRiskCount, pastDueCount } from '@/lib/derived'
import type { Order } from '@/data/types'

/**
 * The colour an order wears, on all three screens that list one.
 *
 * The dashboard, the register and the order header each wrote the ternary out
 * for themselves, and the dashboard's copy had lost the delivered branch — so
 * the one order that is both delivered and past its deadline read green in one
 * place and blue in another. These tests pin the four states the judgement has
 * to distinguish, and the boundaries between them.
 */

afterEach(resetClock)

/** Only the two fields the judgement reads; the rest of an order is irrelevant. */
const at = (hoursFromNow: number, done = false): { due: Date; done?: boolean } => ({
  due: new Date(now().getTime() + hoursFromNow * 3600_000),
  done,
})

describe('the four states an order can be in', () => {
  it('calls a delivered order done, whatever its deadline says', () => {
    expect(orderState(at(-30, true))).toBe('done')
    expect(orderState(at(+30, true))).toBe('done')
  })

  it('calls an undelivered order past its deadline late', () => {
    expect(orderState(at(-0.5))).toBe('late')
  })

  it(`calls one due inside ${SOON_HOURS}h soon`, () => {
    expect(orderState(at(1))).toBe('soon')
    expect(orderState(at(SOON_HOURS - 0.01))).toBe('soon')
  })

  it('calls anything further out open', () => {
    expect(orderState(at(SOON_HOURS))).toBe('open')
    expect(orderState(at(72))).toBe('open')
  })

  it('puts the boundaries where the countdown puts them', () => {
    /* Due exactly now is not yet overdue, and exactly on the window is not yet
       soon — the same two edges `dueMeta` draws for the countdown beside it. */
    expect(orderState(at(0))).toBe('soon')
    expect(dueMeta(at(0).due).kind).toBe('soon')
    expect(dueMeta(at(SOON_HOURS).due).kind).toBe('ok')
  })
})

describe('the chip each state wears', () => {
  it('is green for delivered, red for late, blue for everything still running', () => {
    expect(orderChipKind(at(-30, true))).toBe('v')
    expect(orderChipKind(at(-0.5))).toBe('d')
    expect(orderChipKind(at(1))).toBe('b')
    expect(orderChipKind(at(72))).toBe('b')
  })

  /**
   * The bug, on the register's own data.
   *
   * 4192410-1 was delivered and its deadline has passed. The register and the
   * order header asked `done` first and showed green; the dashboard asked only
   * about the deadline, so the same row came out blue there.
   */
  it('gives the delivered-and-overdue order in the register the delivered chip', () => {
    const shipped = ORDERS.filter((o) => o.done && o.due < now())
    expect(shipped.length, 'the seed no longer contains a delivered, overdue order').toBeGreaterThan(0)
    shipped.forEach((o) => {
      expect(orderChipKind(o), `${o.id} is delivered but does not read as delivered`).toBe('v')
    })
  })

  it('is a case the dashboard’s old expression got wrong — which is why it is pinned', () => {
    /* The counter-example. Without it the assertion above would pass against any
       expression that happens to return 'v' for a delivered order, including one
       that never looks at `done` at all. This is the line the dashboard carried. */
    const asDashboardHadIt = (o: Order) => (o.due < now() && !o.done ? 'd' : 'b')
    const shipped = ORDERS.filter((o) => o.done && o.due < now())

    shipped.forEach((o) => {
      expect(asDashboardHadIt(o), 'the counter-example no longer reproduces').toBe('b')
      expect(orderChipKind(o)).not.toBe(asDashboardHadIt(o))
    })
  })

  it('agrees with the old expression everywhere else, which is the part that was right', () => {
    const asDashboardHadIt = (o: Order) => (o.due < now() && !o.done ? 'd' : 'b')
    ORDERS.filter((o) => !o.done).forEach((o) => {
      expect(orderChipKind(o), `${o.id} changed colour and should not have`).toBe(asDashboardHadIt(o))
    })
  })
})

describe('the states as the register divides them', () => {
  it('gives every order exactly one of the four', () => {
    const states: OrderState[] = ['done', 'late', 'soon', 'open']
    const counted = states.reduce(
      (a, k) => a + ORDERS.filter((o) => orderState(o) === k).length,
      0,
    )
    expect(counted, 'an order fell into two pills or none').toBe(ORDERS.length)
  })

  it('is what the dashboard tiles count', () => {
    expect(pastDueCount()).toBe(ORDERS.filter((o) => orderState(o) === 'late').length)
    expect(atRiskCount()).toBe(ORDERS.filter((o) => orderState(o) === 'soon').length)
    /* Against the seed clock those are real numbers, not two zeroes agreeing. */
    expect(pastDueCount()).toBe(2)
    expect(atRiskCount()).toBe(1)
  })

  it('moves with the clock rather than with a stored flag', () => {
    const order = ORDERS.find((o) => !o.done)!

    setClock(() => new Date(order.due.getTime() - 24 * 3600_000))
    expect(orderState(order)).toBe('open')

    setClock(() => new Date(order.due.getTime() - 1 * 3600_000))
    expect(orderState(order)).toBe('soon')

    setClock(() => new Date(order.due.getTime() + 1 * 3600_000))
    expect(orderState(order)).toBe('late')

    setClock(() => SEED_NOW)
  })
})

describe('the window is one constant', () => {
  it('is what both the state and the countdown read', () => {
    /* Both sides have to move together: the pill that says "Due < 4h" and the
       countdown that colours itself amber are the same threshold twice. */
    const justInside = at(SOON_HOURS - 0.01)
    const justOutside = at(SOON_HOURS + 0.01)

    expect(orderState(justInside)).toBe('soon')
    expect(dueMeta(justInside.due).kind).toBe('soon')
    expect(orderState(justOutside)).toBe('open')
    expect(dueMeta(justOutside.due).kind).toBe('ok')
  })
})

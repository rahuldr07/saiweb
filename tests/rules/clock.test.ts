import { afterEach, describe, expect, it } from 'vitest'
import { SEED_NOW, now, resetClock, setClock } from '@/lib/clock'
import { daysSince, dueMeta, fmtDate } from '@/lib/format'
import { atRiskCount, openCount, pastDueCount } from '@/lib/derived'
import { ORDERS } from '@/data/production'

/**
 * The clock used to be a literal read directly by forty-odd call sites. These
 * tests exist to prove it is genuinely swappable now — that the seed instant is
 * a default rather than a constant, and that everything derived from "now"
 * follows when it moves.
 */

afterEach(resetClock)

describe('the default', () => {
  it('is the design’s pinned instant, so the seed figures stay reproducible', () => {
    expect(now().getTime()).toBe(SEED_NOW.getTime())
    expect(fmtDate(now())).toBe('08/03/2026')
  })
})

describe('swapping it', () => {
  it('moves what "now" means', () => {
    setClock(() => new Date(2027, 0, 15, 9, 0))
    expect(fmtDate(now())).toBe('01/15/2027')
  })

  it('moves every derived judgement with it', () => {
    const deadline = new Date(2026, 7, 3, 20, 0) // three hours after the seed clock

    setClock(() => new Date(2026, 7, 3, 17, 30))
    expect(dueMeta(deadline).kind, 'should be due soon, not late').toBe('soon')

    setClock(() => new Date(2026, 7, 3, 12, 0))
    expect(dueMeta(deadline).kind, 'eight hours out is neither late nor soon').toBe('ok')

    setClock(() => new Date(2026, 7, 4, 9, 0))
    expect(dueMeta(deadline).kind, 'the day after is late').toBe('late')
  })

  it('is what makes "late" derived rather than marked', () => {
    /* Nobody sets a late flag anywhere — it falls out of the due datetime and
       the clock. Moving the clock is therefore enough to change the answer. */
    const due = new Date(2026, 7, 3, 16, 0)
    setClock(() => new Date(2026, 7, 3, 15, 0))
    expect(dueMeta(due).kind).not.toBe('late')
    setClock(() => new Date(2026, 7, 3, 17, 0))
    expect(dueMeta(due).kind).toBe('late')
  })

  it('counts days from wherever the clock is', () => {
    const then = new Date(2026, 6, 24)
    setClock(() => new Date(2026, 7, 3))
    expect(daysSince(then)).toBe(10)
    setClock(() => new Date(2026, 7, 13))
    expect(daysSince(then)).toBe(20)
  })
})

/*
 * The counts the dashboard and the sidebar badge read.
 *
 * They were computed once at module load, which is indistinguishable from
 * correct while the clock is pinned and silently wrong the moment it is not.
 * These assert they move, which is the only way that regression announces
 * itself before real orders do.
 */
describe('the counts the shell reads', () => {
  it('follow the clock rather than the module load', () => {
    setClock(() => SEED_NOW)
    const atSeed = { past: pastDueCount(), risk: atRiskCount(), open: openCount() }

    /* A fortnight on, every open order is long past its promise. */
    setClock(() => new Date(SEED_NOW.getTime() + 14 * 24 * 3600_000))
    expect(pastDueCount()).toBeGreaterThan(atSeed.past)
    expect(atRiskCount()).toBe(0)

    /* Long before any of them arrived, none is due yet. */
    setClock(() => new Date(SEED_NOW.getTime() - 60 * 24 * 3600_000))
    expect(pastDueCount()).toBe(0)
  })

  it('never counts a delivered order as outstanding', () => {
    setClock(() => new Date(SEED_NOW.getTime() + 365 * 24 * 3600_000))
    expect(openCount()).toBe(ORDERS.filter((o) => !o.done).length)
    expect(pastDueCount()).toBeLessThanOrEqual(openCount())
  })
})

describe('resetting it', () => {
  it('puts the seed clock back, so one test cannot leak into the next', () => {
    setClock(() => new Date(2030, 0, 1))
    resetClock()
    expect(now().getTime()).toBe(SEED_NOW.getTime())
  })
})

import { describe, expect, it } from 'vitest'
import { payableDays } from '@/lib/payroll'
import { MONTHDAYS, PAYMONTHS } from '@/data/hrms'
import { STAFF } from '@/data/people'
import type { Person } from '@/data/types'

/**
 * How much of a month a new joiner is paid for is a calendar question, and the
 * calendar does not stop at the five months the seed data carries. These pin the
 * arithmetic inside that window and outside it, because outside it is where
 * reading the month's length from a five-key table divided by `undefined` and
 * put NaN on a payslip.
 */

const joining = (doj: string): Person => ({ ...STAFF[0], id: 'test', n: 'Joiner', doj })

/** March 2026 — 31 days, and one of the five the seed data covers. */
const INSIDE = 'Mar 2026'
/** August 2026 — 31 days, and one it does not. The seed clock is already in it. */
const OUTSIDE = 'Aug 2026'

describe('proration inside the months the seed data carries', () => {
  it('pays a full month to someone who was already here', () => {
    expect(payableDays(joining('01/05/2025'), INSIDE, 26)).toBe(26)
  })

  it('pays nothing to someone who had not joined yet', () => {
    expect(payableDays(joining('06/01/2026'), INSIDE, 26)).toBe(0)
  })

  it('prorates from the joining day', () => {
    /* Joined the 16th of a 31-day month: 16 of its days remain, so 26 × 16/31. */
    expect(payableDays(joining('03/16/2026'), INSIDE, 26)).toBe(13)
  })

  it('pays the whole month to someone who joined on the first of it', () => {
    expect(payableDays(joining('03/01/2026'), INSIDE, 26)).toBe(26)
  })

  it('pays a full month when there is no joining date to prorate from', () => {
    expect(payableDays(joining(''), INSIDE, 26)).toBe(26)
  })
})

describe('a month outside the five', () => {
  it('is genuinely outside them', () => {
    /* The premise of everything below. If the seed window rolls forward far
       enough to cover August, these tests stop testing what they claim to. */
    expect(PAYMONTHS).not.toContain(OUTSIDE)
    expect(MONTHDAYS[OUTSIDE], 'the month under test is no longer an unknown one').toBeUndefined()
  })

  it('prorates against the real length of the month', () => {
    const days = payableDays(joining('08/16/2026'), OUTSIDE, 26)
    expect(Number.isFinite(days), `${OUTSIDE} produced ${days}`).toBe(true)
    /* August is 31 days, so the same 26 × 16/31 as March. */
    expect(days).toBe(13)
  })

  it('is exactly what the table of month lengths could not do', () => {
    /* The counter-example. This is the computation the fix replaced, run on the
       same inputs: the lookup misses, and every figure downstream of it is NaN.
       Without this the assertion above would pass against the old code too. */
    const days = MONTHDAYS[OUTSIDE]
    expect(Math.round((26 * (days - 16 + 1)) / days), 'the defect no longer reproduces').toBeNaN()
  })

  it('knows February is longer in a leap year', () => {
    /* Nothing in the seed data says how long February is, in either year. The
       two answers differ only because the length comes from the calendar:
       joining on the 28th leaves one day of a 28-day month and two of a 29. */
    expect(payableDays(joining('02/28/2026'), 'Feb 2026', 28)).toBe(1)
    expect(payableDays(joining('02/28/2028'), 'Feb 2028', 28)).toBe(2)
  })

  it('pays a full month when the month is not a month at all', () => {
    expect(payableDays(joining('03/16/2026'), 'not a month', 26)).toBe(26)
    expect(payableDays(joining('03/16/2026'), '', 26)).toBe(26)
  })
})

describe('a joining date that is not a joining date', () => {
  /*
   * The other route to the same NaN. Proration reads the month's length from the
   * calendar and the day of joining out of a MM/DD/YYYY string — and a string
   * with no slashes in it carries no day, which would make `days - undefined + 1`
   * the figure on the payslip.
   *
   * A full month is what this function answers whenever it cannot prorate, so
   * that is what an unreadable date gets too.
   */
  const UNREADABLE = ['2026-08-16', '16 August 2026', 'tomorrow', '08/16']

  it('pays a full month rather than NaN days', () => {
    for (const doj of UNREADABLE) {
      const days = payableDays(joining(doj), INSIDE, 26)
      expect(Number.isFinite(days), `${doj} produced ${days}`).toBe(true)
      expect(days, `${doj} should prorate to nothing`).toBe(26)
    }
  })

  it('is the same answer as carrying no joining date at all', () => {
    expect(payableDays(joining('2026-08-16'), INSIDE, 26)).toBe(payableDays(joining(''), INSIDE, 26))
  })

  it('still prorates a date it can read, so the guard is not swallowing them all', () => {
    /* The counter-example. If the guard above were too eager, this would read 26
       as well and the tests further up would be passing for the wrong reason. */
    expect(payableDays(joining('03/16/2026'), INSIDE, 26)).toBe(13)
  })
})

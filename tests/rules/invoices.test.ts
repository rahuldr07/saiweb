import { describe, expect, it } from 'vitest'
import {
  EMPTY_RANGE,
  INVOICE_MONTHS,
  balance,
  inRange,
  monthBounds,
  monthInRange,
  normalise,
  outstandingOf,
  rangeForMonth,
  rangeMonth,
  sumBy,
} from '@/lib/invoices'
import { parseIso } from '@/lib/format'
import { INVOICES } from '@/data/business'

/**
 * Scoping the invoice register, and the money it adds up.
 *
 * One filter with two faces — a month dropdown and a pair of dates — and the
 * property that makes the arrangement worth having is that the two can never
 * contradict each other: a month must produce a range, and that range must
 * report back the month it came from.
 */

describe('a month’s bounds', () => {
  it('reads the label rather than the month’s position in the register', () => {
    /* The bounds used to be counted from an index into INVOICE_MONTHS against a
       hardcoded March 2026. Months the register does not hold prove which of
       the two is being read. */
    expect(monthBounds('Jan 2027')).toEqual(['2027-01-01', '2027-01-31'])
    expect(monthBounds('Dec 2025')).toEqual(['2025-12-01', '2025-12-31'])
  })

  it('gets February right in a leap year and out of one', () => {
    expect(monthBounds('Feb 2028')).toEqual(['2028-02-01', '2028-02-29'])
    expect(monthBounds('Feb 2027')).toEqual(['2027-02-01', '2027-02-28'])
  })

  it('answers nothing for a label that is not a month', () => {
    expect(monthBounds('custom')).toEqual(['', ''])
    expect(monthBounds('Smarch 2026')).toEqual(['', ''])
  })

  it('covers every invoice in the month it is labelled with', () => {
    for (const m of INVOICE_MONTHS) {
      const [from, to] = monthBounds(m)
      for (const i of INVOICES.filter((x) => x.m === m)) {
        expect(inRange(i, { from, to }), `${i.id} falls outside ${m}`).toBe(true)
      }
    }
  })
})

describe('the two faces of the filter', () => {
  it('round-trips every month through its range and back', () => {
    for (const m of INVOICE_MONTHS) expect(rangeMonth(rangeForMonth(m))).toBe(m)
  })

  it('calls no dates “all”, and dates matching no month “custom”', () => {
    expect(rangeMonth(EMPTY_RANGE)).toBe('all')
    expect(rangeMonth({ from: '2026-03-04', to: '2026-03-09' })).toBe('custom')
  })

  it('clears the dates for “all” rather than widening them to cover everything', () => {
    expect(rangeForMonth('all')).toEqual(EMPTY_RANGE)
  })

  it('swaps reversed dates instead of matching nothing', () => {
    expect(normalise({ from: '2026-06-30', to: '2026-06-01' })).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
    })
  })

  it('keeps a month’s column while the range still touches it', () => {
    const first = INVOICE_MONTHS[0]
    const last = INVOICE_MONTHS[INVOICE_MONTHS.length - 1]
    expect(monthInRange(first, rangeForMonth(first))).toBe(true)
    expect(monthInRange(first, rangeForMonth(last))).toBe(false)
    expect(monthInRange(first, EMPTY_RANGE)).toBe(true)
  })
})

describe('filtering on the issue date', () => {
  it('takes everything when both ends are open', () => {
    expect(INVOICES.every((i) => inRange(i, EMPTY_RANGE))).toBe(true)
  })

  it('treats an open end as open, not as today', () => {
    const latest = INVOICES.reduce((a, b) => (a.issued > b.issued ? a : b))
    expect(inRange(latest, { from: null, to: null })).toBe(true)
    expect(inRange(latest, { from: '2020-01-01', to: null })).toBe(true)
  })

  it('includes an invoice issued on the closing day itself', () => {
    const i = INVOICES[0]
    const day = i.issued
    const stamp = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
    expect(inRange(i, { from: stamp, to: stamp })).toBe(true)
    expect(parseIso(stamp).getDate()).toBe(day.getDate())
  })
})

describe('the money', () => {
  it('never leaves a balance a penny off its own invoice', () => {
    for (const i of INVOICES) expect(balance(i)).toBe(Math.round((i.amt - i.paid) * 100) / 100)
  })

  it('adds a set of invoices up the same way whether summed or subtracted', () => {
    expect(outstandingOf(INVOICES)).toBe(
      Math.round((sumBy(INVOICES, 'amt') - sumBy(INVOICES, 'paid')) * 100) / 100,
    )
  })

  it('never reports an invoice as paid beyond its own amount', () => {
    for (const i of INVOICES) expect(i.paid).toBeLessThanOrEqual(i.amt)
  })
})

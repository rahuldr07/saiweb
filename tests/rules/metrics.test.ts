import { afterEach, describe, expect, it } from 'vitest'
import {
  CAPACITY_AMBER,
  CAPACITY_RED,
  capacityTone,
  median,
  onTime30,
  type Delivery,
} from '@/lib/metrics'
import { SEED_NOW, resetClock, setClock } from '@/lib/clock'
import { registerRows } from '@/lib/payroll-csv'
import { paidStaff, payslipOf, type Payslip } from '@/lib/payroll'
import { PAYMONTHS } from '@/data/hrms'
import type { Person } from '@/data/types'

/**
 * The figures the dashboard and the reports quote, and the register that goes to
 * the bank. Two of these have a wrong answer that looks perfectly reasonable —
 * an on-time percentage of zero when nothing was delivered, and a median that is
 * really a mean — so the tests pin the values rather than the shapes.
 */

afterEach(resetClock)

const delivery = (daysAgo: number, late: boolean, id = `ORD-${daysAgo}`): Delivery => ({
  id,
  d: new Date(SEED_NOW.getTime() - daysAgo * 86400000),
  dk: '',
  cl: 'MGR',
  pr: 'COS',
  slaH: 24,
  st: {},
  by: {},
  byName: {},
  hrs: 12,
  late,
})

describe('on-time over thirty days', () => {
  it('is the share delivered inside the promise, as a percentage', () => {
    const out = onTime30([
      delivery(1, false),
      delivery(2, false),
      delivery(3, false),
      delivery(4, true),
    ])
    expect(out.pct).toBe(75)
    expect(out.total).toBe(4)
    expect(out.late).toBe(1)
  })

  it('carries only the late deliveries, which is what the drilldown lists', () => {
    const out = onTime30([delivery(1, false), delivery(2, true, 'ORD-LATE'), delivery(3, false)])
    expect(out.rows.map((r) => r.id)).toEqual(['ORD-LATE'])
  })

  it('counts the thirtieth day and nothing older', () => {
    const onTheLine: Delivery = {
      ...delivery(0, false, 'ORD-EDGE'),
      d: new Date(SEED_NOW.getTime() - 30 * 86400000),
    }
    const aMomentTooOld: Delivery = {
      ...delivery(0, true, 'ORD-OLD'),
      d: new Date(SEED_NOW.getTime() - 30 * 86400000 - 1),
    }
    const out = onTime30([onTheLine, aMomentTooOld])
    expect(out.total).toBe(1)
    expect(out.pct).toBe(100)
  })

  it('says null when nothing was delivered, not zero', () => {
    /* The KPI renders null as an em dash and zero as "0.0%" under a warning
       tone. Turning this into 0 would put "nothing was delivered on time" on the
       dashboard of a quiet month, which is a reporting claim nobody made. */
    expect(onTime30([]).pct).toBeNull()
    expect(onTime30([])).toEqual({ pct: null, total: 0, late: 0, rows: [] })

    /* Everything outside the window is the same case: no evidence, not a nil. */
    expect(onTime30([delivery(31, false), delivery(90, true)]).pct).toBeNull()
  })

  it('still says zero when everything in the window was late', () => {
    /* The counter-example that makes the null above load-bearing: zero is a real
       answer this function does give, so null cannot be read as its stand-in. */
    const out = onTime30([delivery(1, true), delivery(2, true)])
    expect(out.pct).toBe(0)
    expect(out.total).toBe(2)
    expect(out.late).toBe(2)
  })

  it('moves the window with the clock rather than with the data', () => {
    const rows = [delivery(1, false), delivery(2, true)]
    expect(onTime30(rows).total).toBe(2)

    setClock(() => new Date(SEED_NOW.getTime() + 60 * 86400000))
    expect(onTime30(rows).pct, 'a two-month-old delivery is still being counted').toBeNull()
  })
})

describe('median', () => {
  it('sorts before it picks, so the caller need not', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([100, 1, 50])).toBe(50)
  })

  it('averages the two middles on an even count', () => {
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median([2, 4, 6, 100])).toBe(5)
    /* Unsorted, so the even branch cannot pass by reading the array as given. */
    expect(median([4, 1, 3, 2])).toBe(2.5)
  })

  it('is a median and not a mean, which is the whole reason it exists', () => {
    /* Three orders around a day and one that stalled a fortnight on a doc
       request. The mean lands at 108 hours, where no order actually sits. */
    const hours = [22, 24, 26, 360]
    expect(median(hours)).toBe(25)
    expect(hours.reduce((a, b) => a + b, 0) / hours.length).toBe(108)
  })

  it('answers zero for an empty list', () => {
    expect(median([])).toBe(0)
  })

  it('answers a single value with itself', () => {
    expect(median([7])).toBe(7)
  })

  it('leaves the caller’s array in the order it was handed', () => {
    /* Every call site passes a freshly mapped list except the ones that do not;
       sorting in place would quietly reorder a table somebody is reading. */
    const xs = [3, 1, 2]
    median(xs)
    expect(xs).toEqual([3, 1, 2])
  })
})

describe('the capacity colour', () => {
  /* Assignment and Reports both draw a load bar. A department at 78% reading
     amber on one screen and green on the other is the failure this pins. */
  it('is one scale, whichever screen draws the bar', () => {
    expect(capacityTone(50)).toEqual({ fill: 'var(--ok)', text: 'gr' })
    expect(capacityTone(80)).toEqual({ fill: 'var(--warn)', text: 'warn' })
    expect(capacityTone(120)).toEqual({ fill: 'var(--bad)', text: 'bad' })
  })

  it('compares strictly, so a load sitting on a threshold keeps the calmer colour', () => {
    expect(capacityTone(CAPACITY_AMBER).fill).toBe('var(--ok)')
    expect(capacityTone(CAPACITY_AMBER + 1).fill).toBe('var(--warn)')
    expect(capacityTone(CAPACITY_RED).fill).toBe('var(--warn)')
    expect(capacityTone(CAPACITY_RED + 1).fill).toBe('var(--bad)')
  })

  it('greys the figure while the bar is green, and colours it with the bar after that', () => {
    /* The two outputs are not the same word: the design leaves a healthy number
       grey rather than green, which is why the caller cannot derive one from
       the other. */
    expect(capacityTone(50).text).toBe('gr')
    expect(capacityTone(85).text).toBe('warn')
    expect(capacityTone(99).text).toBe('bad')
  })
})

describe('the payroll register', () => {
  const base = payslipOf(paidStaff()[0], PAYMONTHS[PAYMONTHS.length - 1])

  const slip = (over: Partial<Payslip>): Payslip => ({ ...base, ...over })
  const person = (over: Partial<Person>): Person => ({ ...base.p, ...over })

  /**
   * The column order is the contract: this file is read by a bank, against a
   * mapping nobody in this repository can see. The row below is written out by
   * hand, with nine distinct figures, so that any two columns swapping places
   * fails here rather than in a payment run.
   */
  it('writes the nine columns in the order the bank is mapped to', () => {
    const rows = registerRows([
      slip({
        p: person({ n: 'Asha Rao', dep: ['Search', 'Search QC'] }),
        lopDays: 2,
        gross: 90000,
        epf: 1800,
        pt: 200,
        esi: 137,
        tds: 4500,
        net: 83363,
      }),
    ])

    expect(rows[0]).toEqual([
      'Name',
      'Department',
      'Unpaid days',
      'Gross',
      'PF',
      'PT',
      'ESI',
      'TDS',
      'Net pay',
    ])
    expect(rows[1]).toEqual(['Asha Rao', 'Search', 2, 90000, 1800, 200, 137, 4500, 83363])
  })

  it('names one department, the first, rather than joining them', () => {
    /* A joined list would carry a comma into a column the bank reads as a
       code — and somebody with no department must not shift the row. */
    const rows = registerRows([
      slip({ p: person({ n: 'No Dept', dep: [] }) }),
      slip({ p: person({ n: 'Two Depts', dep: ['Typing', 'Typing QC'] }) }),
    ])
    expect(rows[1][1]).toBe('')
    expect(rows[2][1]).toBe('Typing')
    expect(rows[1]).toHaveLength(9)
  })

  it('reports the unpaid days attendance recorded, not the joiner’s part month', () => {
    /* `unpaid` includes the days before somebody joined, which are not a
       deduction anyone owes an explanation for; the register shows `lopDays`. */
    const rows = registerRows([slip({ lopDays: 2, unpaid: 11 })])
    expect(rows[1][2]).toBe(2)
  })

  it('is a header and one row per payslip, with the header there even for none', () => {
    expect(registerRows([])).toEqual([
      ['Name', 'Department', 'Unpaid days', 'Gross', 'PF', 'PT', 'ESI', 'TDS', 'Net pay'],
    ])
    expect(registerRows([slip({}), slip({}), slip({})])).toHaveLength(4)
  })
})

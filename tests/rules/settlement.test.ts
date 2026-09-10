import { afterEach, describe, expect, it } from 'vitest'
import { ATT, OT } from '@/data/hrms'
import { LOANS } from '@/data/loans'
import { STAFF } from '@/data/people'
import { resetClock, setClock } from '@/lib/clock'
import { otMinsFor, otPay, paidStaff, payTotals, payslipOf, settlement, words } from '@/lib/payroll'
import type { AttendanceRow, Person } from '@/data/types'

/**
 * The parts of payroll that are a judgement rather than an identity: what an
 * hour of overtime is worth, what somebody is owed on the way out, what the
 * month costs as a whole, and how the net figure is said aloud.
 *
 * Every expected number here is worked out from the CTC on the record and the
 * settings on the Company screen, not read back out of the function. So a change
 * to the structure has to be argued for in this file rather than absorbed by it.
 */

afterEach(resetClock)

const person = (id: string): Person => {
  const p = STAFF.find((s) => s.id === id)
  if (!p) throw new Error(`no one with id ${id} on the roster`)
  return p
}

const UMA = person('us')
const DEV = person('dn')
const KAV = person('kv')
const NEIL = person('nb')
const BHAVANI = person('bn')

const JUL = 'Jul 2026'

/* Uma Sankar, ₹3,40,000 a year — ₹28,333.33 a month. Basic is 50% of that =
   ₹14,167; HRA is 40% of basic = ₹5,667; employer PF is 12% = ₹1,700 and the
   gratuity provision 4.81% = ₹681; the special allowance is the ₹6,118 left
   over. Monthly gross ₹25,952. Neil Barrow, ₹2,74,000: basic ₹11,417, HRA
   ₹4,567, special ₹4,930, gross ₹20,914 — the only gross under the ₹21,000 ESI
   ceiling. Bhavani N, ₹2,88,000: basic ₹12,000, gross ₹21,983. */
const UMA_GROSS = 25952
const NEIL_GROSS = 20914

const DAY_MS = 24 * 3600 * 1000
/* `yearsServed` divides by 365.25 days, so the fifth anniversary it tests
   against is this instant and not the calendar date. */
const YEAR_MS = 365.25 * DAY_MS
const fiveYearsAfter = (doj: Date) => new Date(doj.getTime() + 5 * YEAR_MS)

const UMA_JOINED = new Date(2024, 10, 12)
const NEIL_JOINED = new Date(2020, 8, 25)
/* A settlement dated the last day of July, so moving the clock moves only the
   gratuity and the leave balance. */
const LAST_DAY = new Date(2026, 6, 31)

describe('the roster these figures are worked out from', () => {
  /* Not a behaviour — a guard. If the seed moves, the arithmetic below should
     fail here with the reason rather than twenty lines down with a number. */
  it('is unchanged', () => {
    expect(UMA.ctc).toBe(340000)
    expect(UMA.doj).toBe('11/12/2024')
    expect(DEV.ctc).toBe(323000)
    expect(NEIL.ctc).toBe(274000)
    expect(NEIL.doj).toBe('09/25/2020')
    expect(BHAVANI.ctc).toBe(288000)
    expect(ATT[JUL].us.working).toBe(27)
    expect(paidStaff()).toHaveLength(28)
  })
})

describe('overtime', () => {
  it('pays the ordinary hourly rate for the month it was worked in', () => {
    /* 95 approved minutes. July has 27 working days, so an hour is
       25952 ÷ 27 ÷ 8 = ₹120.1481, and 95 minutes of it is ₹190.2346. */
    expect(otPay(UMA, JUL)).toBe(190)
  })

  it('is a different rate for every gross', () => {
    /* Devendra: 70 minutes at 24655 ÷ 27 ÷ 8 = ₹114.1435 an hour = ₹133.1674.
       Same month, same rule, a rate of his own. */
    expect(otPay(DEV, JUL)).toBe(133)
  })

  it('rounds the rupee rather than carrying paise onto the payslip', () => {
    expect(Number.isInteger(otPay(UMA, JUL))).toBe(true)
    expect(Number.isInteger(otPay(DEV, JUL))).toBe(true)
    /* Both of the above land just above the rupee and are paid down to it: at
       ₹190.2346 and ₹133.1674, rounding up would pay 191 and 134. */
    expect(otPay(UMA, JUL) + otPay(DEV, JUL)).toBe(323)
  })

  it('pays nothing for overtime nobody has approved', () => {
    /* The counter-example is the seed data itself: Kavitha's is the largest
       overtime record in the month, and at 24197 ÷ 27 ÷ 8 it would be worth
       ₹224. Zero here is the approval gate, not an absent row. */
    const pending = OT.find((o) => o.who === 'kv' && o.st === 'pending')
    expect(pending?.mins).toBe(120)
    expect(otMinsFor('kv', JUL)).toBe(0)
    expect(otPay(KAV, JUL)).toBe(0)
  })

  it('pays nothing in a month nobody worked overtime in', () => {
    expect(otPay(UMA, 'Jun 2026')).toBe(0)
    expect(otPay(UMA, '')).toBe(0)
  })

  it('states the approved minutes on the payslip line it adds', () => {
    expect(payslipOf(UMA, JUL).earn).toContainEqual(['Overtime — 1h 35m approved', 190])
    expect(payslipOf(DEV, JUL).earn).toContainEqual(['Overtime — 1h 10m approved', 133])
  })
})

describe('gratuity at the five-year threshold', () => {
  /* Fifteen days of basic per completed year: 14167 × 15 ÷ 26 = ₹8,173.2692 a
     year. Five of them is ₹40,866; six is ₹49,040. */
  const FIVE_YEARS_OF_IT = 40866
  const SIX_YEARS_OF_IT = 49040

  it('pays none of it the day before the anniversary', () => {
    setClock(() => new Date(fiveYearsAfter(UMA_JOINED).getTime() - DAY_MS))
    const f = settlement(UMA, LAST_DAY)
    expect(f.lines[2]).toEqual([
      'Gratuity — 5.0 years served, under the five-year threshold',
      0,
    ])
    expect(f.total).toBe(34541)
  })

  it('pays five years of it on the anniversary itself', () => {
    setClock(() => fiveYearsAfter(UMA_JOINED))
    const f = settlement(UMA, LAST_DAY)
    expect(f.yrs).toBe(5)
    expect(f.lines[2]).toEqual(['Gratuity — 5 completed years at 15 days of basic', FIVE_YEARS_OF_IT])
    /* The day before totalled 34541. One day of service is worth ₹40,866 here,
       which is the whole point of the threshold. */
    expect(f.total).toBe(75407)
  })

  it('pays the same five years the day after', () => {
    setClock(() => new Date(fiveYearsAfter(UMA_JOINED).getTime() + DAY_MS))
    const f = settlement(UMA, LAST_DAY)
    expect(f.lines[2]).toEqual(['Gratuity — 5 completed years at 15 days of basic', FIVE_YEARS_OF_IT])
  })

  it('counts completed years only, so the sixth arrives whole', () => {
    setClock(() => new Date(UMA_JOINED.getTime() + 6 * YEAR_MS - DAY_MS))
    expect(settlement(UMA, LAST_DAY).lines[2][1]).toBe(FIVE_YEARS_OF_IT)

    setClock(() => new Date(UMA_JOINED.getTime() + 6 * YEAR_MS))
    expect(settlement(UMA, LAST_DAY).lines[2]).toEqual([
      'Gratuity — 6 completed years at 15 days of basic',
      SIX_YEARS_OF_IT,
    ])
  })

  it('pays none of it, and says why, with no joining date on the record', () => {
    setClock(() => fiveYearsAfter(UMA_JOINED))
    const undated: Person = { ...UMA, doj: '' }
    const f = settlement(undated, LAST_DAY)
    expect(f.yrs).toBeNull()
    expect(f.lines[2]).toEqual(['Gratuity — no joining date on record', 0])
    expect(f.total).toBe(34541)
  })

  it('reads a date it cannot parse as no date rather than as NaN years', () => {
    /* A joining date the register holds in some other shape is no date, and the
       line already has words for that. What it must not do is reach the
       arithmetic: NaN years is neither under nor over the five-year threshold,
       and a settlement slip cannot say "NaN years served". */
    setClock(() => fiveYearsAfter(UMA_JOINED))
    const misshapen: Person = { ...UMA, doj: '2024-11-12' }
    const f = settlement(misshapen, LAST_DAY)
    expect(f.yrs).toBeNull()
    expect(f.lines[2]).toEqual(['Gratuity — no joining date on record', 0])
  })
})

describe('the rest of a settlement', () => {
  it('encashes the paid leave left at the basic day rate', () => {
    /* Paid leave accrues 18 a year by the month, so 11 November is 17 days
       earned; Uma has taken 3. Fourteen days at 14167 ÷ 26 = ₹7,628. */
    setClock(() => fiveYearsAfter(UMA_JOINED))
    const f = settlement(UMA, LAST_DAY)
    expect(f.bal.pl.left).toBe(14)
    expect(f.lines[1]).toEqual(['Leave encashment — 14 days of paid leave', 7628])
  })

  it('says "day" when only one is left', () => {
    /* March: 18 × 3 ÷ 12 accrues 4.5, rounded to 5, and Bhavani has taken 4.
       One day of ₹12,000 basic over 26 is ₹462. */
    setClock(() => new Date(2026, 2, 15))
    expect(settlement(BHAVANI, LAST_DAY).lines[1]).toEqual([
      'Leave encashment — 1 day of paid leave',
      462,
    ])
  })

  it('recovers what is still outstanding on a loan, as the last line', () => {
    /* Neil's ₹24,000 loan has ₹16,000 repaid, so ₹8,000 comes back off the
       settlement. Salary is 20914 ÷ 27 × 28 days; September accrues 14 days of
       paid leave against 3 taken, so 11 × 11417 ÷ 26 = ₹4,830 is encashed; five
       completed years at 11417 × 15 ÷ 26 = ₹32,934. */
    setClock(() => fiveYearsAfter(NEIL_JOINED))
    const f = settlement(NEIL, LAST_DAY)
    expect(f.lines).toEqual([
      ['Salary to the last working day', 21689],
      ['Leave encashment — 11 days of paid leave', 4830],
      ['Gratuity — 5 completed years at 15 days of basic', 32934],
      ['Advance outstanding, recovered', -8000],
    ])
    expect(f.total).toBe(51453)

    const loan = LOANS.find((l) => l.who === 'nb')
    expect(loan && loan.amt - loan.paid).toBe(8000)
  })

  it('leaves the advance line off when there is nothing to recover', () => {
    setClock(() => fiveYearsAfter(UMA_JOINED))
    expect(settlement(UMA, LAST_DAY).lines).toHaveLength(3)
  })

  it('pro-rates the salary to the day given rather than the day it is run', () => {
    setClock(() => fiveYearsAfter(UMA_JOINED))
    /* Half a month of a 27-day month rounds up to 14 days: 25952 ÷ 27 × 14. */
    expect(settlement(UMA, new Date(2026, 6, 15)).lines[0]).toEqual([
      'Salary to the last working day',
      13457,
    ])
  })

  it('pays more than a full month to someone leaving on the 31st', () => {
    /* The pro-rating divides by a nominal 30-day month, so 27 working days ×
       31 ÷ 30 rounds to 28 payable days — one more than the month has. The
       whole month's gross is ₹25,952 and the settlement pays ₹26,913. */
    setClock(() => fiveYearsAfter(UMA_JOINED))
    const f = settlement(UMA, LAST_DAY)
    expect(ATT[JUL].us.working).toBe(27)
    expect(f.lines[0]).toEqual(['Salary to the last working day', 26913])
    expect(f.lines[0][1] - UMA_GROSS).toBe(961)
  })

  it('settles someone with no attendance row against a 26-day month', () => {
    /* Nobody by this id is in the register, so the fallback stands in for the
       month: 25952 ÷ 26 × 27 payable days, and no leave taken, so all 17 accrued
       days are encashed at 14167 ÷ 26. */
    setClock(() => fiveYearsAfter(UMA_JOINED))
    const unrostered: Person = { ...UMA, id: 'zz' }
    const f = settlement(unrostered, LAST_DAY)
    expect(f.lines[0]).toEqual(['Salary to the last working day', 26950])
    expect(f.lines[1]).toEqual(['Leave encashment — 17 days of paid leave', 9263])
    expect(f.total).toBe(77079)
  })

  it('is the sum of the lines it shows, so nothing is added off the slip', () => {
    setClock(() => fiveYearsAfter(NEIL_JOINED))
    const f = settlement(NEIL, LAST_DAY)
    expect(f.total).toBe(f.lines.reduce((a, [, v]) => a + v, 0))
    expect(f.st.gross).toBe(NEIL_GROSS)
  })
})

describe('the month as a whole', () => {
  it('names exactly the people with unpaid days, and how many', () => {
    /* Straight off the July attendance: Devendra 1, Rajesh 1, Kavitha 1,
       Suresh 2, Neil 1, Vikki 3. Nobody else. */
    const lop = payTotals(JUL).lop.map((s) => [s.p.id, s.unpaid])
    expect(lop).toEqual([
      ['dn', 1],
      ['rm', 1],
      ['kv', 1],
      ['sr', 2],
      ['nb', 1],
      ['vs', 3],
    ])
  })

  it('adds July up to the rupee', () => {
    /* 28 people at the structure their CTC gives them, each cut by their unpaid
       days, plus Kavitha's ₹4,200 of arrears and ₹323 of approved overtime.
       Neil is the only gross under the ESI ceiling and Harry the only one above
       the rebate threshold, which is why those two totals are one person each.
       July's own loan ledger recovers ₹21,000 that month — Rajesh's ₹6,000
       EMI, Neil's ₹4,000, Damodaran's ₹6,000 and Vikki's ₹5,000 — so ded and
       net carry that on top of the statutory deductions. */
    const t = payTotals(JUL)
    expect(t.list).toHaveLength(28)
    expect(t.gross).toBe(876006)
    expect(t.ded).toBe(77482)
    expect(t.net).toBe(800764)
    expect(t.pf).toBe(45094)
    expect(t.erpf).toBe(45640)
    expect(t.esi).toBe(151)
    expect(t.pt).toBe(5600)
    expect(t.tds).toBe(5637)
    expect(t.grat).toBe(22801)
    expect(t.loans).toBe(21000)
  })

  it('pays a full month for a month it has no attendance for', () => {
    /* An unrecognised month falls back to a notional 26 working days with none
       of them unpaid, so an empty month label produces a complete register —
       and a dearer one than the July it stands in for. An empty label is also
       a month the loan ledger has never recorded, so every currently-active
       loan/advance shows its live, clamped instalment: Rajesh ₹6,000, Neil
       ₹4,000, Damodaran ₹6,000, and Sathya's single-instalment ₹12,000
       advance, which is being recovered in full — ₹28,000 in all. */
    const t = payTotals('')
    expect(t.list).toHaveLength(28)
    expect(t.lop).toEqual([])
    expect(t.gross).toBe(879811)
    expect(t.gross).toBeGreaterThan(payTotals(JUL).gross)
    expect(t.ded).toBe(85034)
    expect(t.net).toBe(794777)
    expect(t.pf).toBe(45640)
    expect(t.esi).toBe(157)
    expect(t.pt).toBe(5600)
    expect(t.tds).toBe(5637)
    expect(t.loans).toBe(28000)
  })

  it('recovers the live, active loans in a month that does not exist', () => {
    /* A month never seen by the ledger is the live preview — what the very
       next run would recover, not tied to any specific month. */
    const t = payTotals('')
    expect(t.ded - (t.pf + t.esi + t.pt + t.tds)).toBe(28000)
  })
})

describe('the amount in words', () => {
  it('groups by crore, lakh and thousand', () => {
    expect(words(1234567)).toBe('Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Only')
    expect(words(10000000)).toBe('One Crore Only')
    expect(words(100000)).toBe('One Lakh Only')
    expect(words(1000)).toBe('One Thousand Only')
  })

  it('skips the groups that are empty rather than saying zero of them', () => {
    expect(words(10000567)).toBe('One Crore Five Hundred Sixty Seven Only')
    expect(words(100000)).not.toContain('Thousand')
  })

  it('says the teens, the tens and the hundreds', () => {
    expect(words(15)).toBe('Fifteen Only')
    expect(words(20)).toBe('Twenty Only')
    expect(words(21)).toBe('Twenty One Only')
    expect(words(119)).toBe('One Hundred Nineteen Only')
    expect(words(900)).toBe('Nine Hundred Only')
  })

  it('rounds to the rupee, because paise are not said aloud', () => {
    expect(words(1234.4)).toBe('One Thousand Two Hundred Thirty Four Only')
    expect(words(1234.6)).toBe('One Thousand Two Hundred Thirty Five Only')
  })

  it('says a net below zero rather than reading the gap off the end of its tables', () => {
    /* The negative net the last test in this file produces is real, so `words`
       has to have a reading for it. The grouping is done on the magnitude and
       the sign is said in front, because every group of a negative figure
       indexes before the start of the tables — and a slip cannot read
       "undefined Crore undefined Lakh". */
    expect(words(-5637)).toBe('Minus Five Thousand Six Hundred Thirty Seven Only')
    expect(words(-1)).toBe('Minus One Only')
    expect(words(-1234567)).toBe(
      'Minus Twelve Lakh Thirty Four Thousand Five Hundred Sixty Seven Only',
    )
    /* Same digits, same words — only the sign in front differs. */
    expect(words(-1234567)).toBe(`Minus ${words(1234567)}`)
  })

  it('says a net of nothing as "Zero", without the "Only" every other net ends in', () => {
    /* Pinned rather than endorsed: the payslip reads "Rupees {words} · credited
       to the account…", so the one slip that pays nothing is also the one whose
       sentence is punctuated differently. */
    expect(words(0)).toBe('Zero')
    expect(words(0.4)).toBe('Zero')
    expect(words(1)).toBe('One Only')
  })
})

describe('a payslip with no paid days at all', () => {
  /* A month of its own, added and removed here, so nothing else in the register
     sees it. It is what makes `words(0)` above reachable rather than trivia. */
  const SPARE = 'Feb 2026'
  const row = (lop: number): AttendanceRow => ({
    days: 28,
    working: 24,
    hol: 0,
    lop,
    paidLeave: 0,
    payable: 24,
    joined: false,
    present: 24 - lop,
  })

  afterEach(() => {
    delete ATT[SPARE]
  })

  it('earns nothing, deducts nothing, and nets nothing', () => {
    ATT[SPARE] = { us: row(24) }
    const s = payslipOf(UMA, SPARE)
    expect(s.gross).toBe(0)
    /* The whole month is lost pay: 24 days at 25952 ÷ 24. */
    expect(s.lopAmt).toBe(UMA_GROSS)
    expect(s.epf).toBe(0)
    expect(s.esi).toBe(0)
    expect(s.pt).toBe(0)
    expect(s.totalDed).toBe(0)
    expect(s.net).toBe(0)
    expect(words(s.net)).toBe('Zero')
  })

  it('reads like every other slip again the moment one day is paid', () => {
    /* The counter-example. One paid day of 24: basic ₹590, HRA ₹236, special
       ₹255 = ₹1,081 gross, less ₹71 of PF, ₹8 of ESI and the ₹200 professional
       tax that a gross of any size attracts. */
    ATT[SPARE] = { us: row(23) }
    const s = payslipOf(UMA, SPARE)
    expect(s.gross).toBe(1081)
    expect(s.epf).toBe(71)
    expect(s.esi).toBe(8)
    expect(s.pt).toBe(200)
    expect(s.net).toBe(802)
    expect(words(s.net)).toBe('Eight Hundred Two Only')
  })

  it('still deducts a full month of tax from the people who pay any', () => {
    /* Tax is taken on the structure rather than on what was earned, so a month
       with no pay at all still deducts a month of it and the net goes below
       zero. Harry's ₹1,09,051 gross is the only one over the rebate threshold,
       at ₹5,637 a month. */
    ATT[SPARE] = { hw: row(24) }
    const s = payslipOf(person('hw'), SPARE)
    expect(s.gross).toBe(0)
    expect(s.tds).toBe(5637)
    expect(s.net).toBe(-5637)
    /* And the slip says so, rather than saying it in undefineds. */
    expect(words(s.net)).toBe('Minus Five Thousand Six Hundred Thirty Seven Only')
  })
})

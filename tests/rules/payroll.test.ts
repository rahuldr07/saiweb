import { afterEach, describe, expect, it } from 'vitest'
import {
  leaveBalance,
  monthOf,
  otMinsFor,
  paidStaff,
  payslipOf,
  settlement,
  structureOf,
  taxUnder,
  ytd,
} from '@/lib/payroll'
import { mins } from '@/lib/timeclock'
import { resetClock, setClock } from '@/lib/clock'
import { PAYCFG, PAYMONTHS } from '@/data/hrms'

/**
 * Payroll derives everything from one number — the CTC on a person's record —
 * and nothing on a payslip is typed twice. So the tests are arithmetic
 * identities: if any of these stop holding, a payslip is wrong, and a wrong
 * payslip is a statutory problem rather than a display bug.
 */

const staff = paidStaff()
const month = PAYMONTHS[PAYMONTHS.length - 1]

describe('the structure', () => {
  it('has someone to test', () => {
    expect(staff.length).toBeGreaterThan(0)
  })

  it('reconstitutes the CTC from its parts, for everyone', () => {
    /* CTC = gross + employer PF + gratuity. Rounding is per component, so allow
       a rupee or two of slack per month and no more. */
    staff.forEach((p) => {
      const s = structureOf(p)
      const rebuilt = (s.gross + s.epfEr + s.grat) * 12
      expect(Math.abs(rebuilt - s.ctc), `${p.n}: structure does not add back to CTC`).toBeLessThan(60)
    })
  })

  it('follows the 50% wage rule', () => {
    staff.forEach((p) => {
      const s = structureOf(p)
      expect(s.basic, `${p.n}: basic is not ${PAYCFG.basicPct}% of monthly`).toBe(
        Math.round((s.ctc / 12) * (PAYCFG.basicPct / 100)),
      )
      expect(s.gross).toBe(s.basic + s.hra + s.special)
    })
  })

  it('never produces a negative component', () => {
    staff.forEach((p) => {
      const s = structureOf(p)
      Object.entries(s).forEach(([k, v]) => {
        expect(v, `${p.n}: ${k} is negative`).toBeGreaterThanOrEqual(0)
      })
    })
  })
})

describe('a payslip', () => {
  it('nets out to gross minus deductions plus reimbursements, for everyone', () => {
    staff.forEach((p) => {
      const s = payslipOf(p, month)
      expect(s.net, `${p.n}: net does not reconcile`).toBe(s.gross - s.totalDed + s.claims)
    })
  })

  it('totals its own deduction lines', () => {
    staff.forEach((p) => {
      const s = payslipOf(p, month)
      const listed = s.ded.reduce((a, [, v]) => a + v, 0)
      expect(listed, `${p.n}: the deduction lines do not sum to the total shown`).toBe(s.totalDed)
    })
  })

  it('totals its own earning lines', () => {
    staff.forEach((p) => {
      const s = payslipOf(p, month)
      const listed = s.earn.reduce((a, [, v]) => a + v, 0)
      expect(listed, `${p.n}: the earning lines do not sum to the gross shown`).toBe(s.gross)
    })
  })

  it('turns an unpaid day into a deduction without anyone retyping it', () => {
    /* Attendance feeds payroll directly. Someone with unpaid days must earn less
       than their full structure; someone with none must earn exactly it. */
    staff.forEach((p) => {
      const s = payslipOf(p, month)
      const full = structureOf(p).gross
      if (s.unpaid > 0) {
        expect(s.lopAmt, `${p.n} has ${s.unpaid} unpaid days but no loss of pay`).toBeGreaterThan(0)
      } else {
        expect(s.lopAmt).toBe(0)
      }

      /* Take the two things that can push a month above the structure back out —
         arrears, and approved overtime — and what is left has to be the structure
         less the loss of pay. Stated the other way round, the deduction the slip
         announces has to be the deduction it actually applied. The two routes
         round differently — three components each, against one per-day figure —
         and the widest gap that opens across the seed roster is a rupee. */
      if (otMinsFor(p.id, month) === 0) {
        expect(
          Math.abs(s.gross - s.arr - (full - s.lopAmt)),
          `${p.n}: the loss of pay shown is not the loss of pay taken`,
        ).toBeLessThanOrEqual(2)
      }
    })
  })

  /**
   * The figure above, worked out by hand for one person, because a property that
   * holds for everyone can still hold at the wrong number.
   *
   * Kavitha V, July 2026 — the only month in the seed carrying arrears, so it is
   * also the case the deleted assertion was gesturing at: a month can pay more
   * than the structure and still owe a day.
   *
   *   CTC 3,17,000 → 26,417 a month → basic 13,208, HRA 5,283, special 5,706,
   *   so the structure grosses 24,197 across 27 working days: 896 a day.
   *   One unpaid day pays 26/27 of each line — 12,719 + 5,087 + 5,495 = 23,301 —
   *   and the 4,200 backdated revision is paid on top of that, not scaled by it.
   */
  it('states a July gross that adds up by hand, arrears and all', () => {
    const kavitha = staff.find((p) => p.id === 'kv')!
    const s = payslipOf(kavitha, 'Jul 2026')

    expect(structureOf(kavitha).gross).toBe(24_197)
    expect(s.unpaid).toBe(1)
    expect(s.lopAmt).toBe(896)
    expect(s.arr).toBe(4_200)
    expect(s.gross).toBe(27_501)
    expect(s.gross, 'arrears are being pro-rated by attendance').toBeGreaterThan(
      structureOf(kavitha).gross,
    )
  })

  it('never pays a negative net', () => {
    staff.forEach((p) => {
      PAYMONTHS.forEach((m) => {
        expect(payslipOf(p, m).net, `${p.n} nets negative in ${m}`).toBeGreaterThanOrEqual(0)
      })
    })
  })
})

describe('year to date', () => {
  it('is the sum of the months up to and including the one shown', () => {
    staff.slice(0, 5).forEach((p) => {
      const upto = PAYMONTHS.slice(0, PAYMONTHS.indexOf(month) + 1)
      const byHand = upto.reduce((a, m) => a + payslipOf(p, m).net, 0)
      expect(ytd(p, month).net, `${p.n}: YTD net disagrees with the months it covers`).toBe(byHand)
    })
  })
})

describe('income tax', () => {
  it('rebates the low end to nothing under both regimes', () => {
    expect(taxUnder('new', 500_000)).toBe(0)
    expect(taxUnder('old', 400_000)).toBe(0)
  })

  it('never falls as income rises', () => {
    let previous = -1
    for (let gross = 200_000; gross <= 5_000_000; gross += 100_000) {
      const tax = taxUnder('new', gross)
      expect(tax, `tax fell between ${gross - 100_000} and ${gross}`).toBeGreaterThanOrEqual(previous)
      previous = tax
    }
  })

  it('never taxes more than the income', () => {
    for (let gross = 100_000; gross <= 10_000_000; gross += 250_000) {
      expect(taxUnder('new', gross)).toBeLessThan(gross)
      expect(taxUnder('old', gross)).toBeLessThan(gross)
    }
  })
})

describe('leave balances', () => {
  afterEach(resetClock)

  /**
   * Unpaid leave is defined as everything beyond the balance, so it is the one
   * kind nobody accrues and the one kind being overdrawn on is the point. The
   * claims below are about the four kinds that carry an entitlement.
   */
  const ACCRUING = ['pl', 'cl', 'sl', 'co']

  it('never shows more taken than earned, or a negative balance', () => {
    staff.forEach((p) => {
      Object.entries(leaveBalance(p.id))
        .filter(([kind]) => ACCRUING.includes(kind))
        .forEach(([kind, b]) => {
          /* Nobody on the roster has booked past their accrual — three of them
             sit exactly on it, so this holds by a margin of zero and not by
             luck. The counter-example below relies on it: the only way to reach
             the clamp is to move the clock back, not to find an overdrawn
             record. */
          expect(
            b.taken + b.pending,
            `${p.n}/${kind}: booked ${b.taken + b.pending} days against ${b.earned} accrued`,
          ).toBeLessThanOrEqual(b.earned)

          /* Which makes the clamp inert here, so state the subtraction itself
             rather than restating the clamp. A balance that stopped counting
             pending requests, or counted comp-off by the wrong rule, shows up
             as a wrong number rather than as a merely non-negative one. */
          expect(b.left, `${p.n}/${kind}: the balance shown is not what is left`).toBe(
            b.earned - b.taken - b.pending,
          )
        })
    })
  })

  /**
   * Paid leave accrues by the month, so the balance a person is shown depends on
   * when they look — which is the part a property test cannot see, because it
   * asks the same question at the same instant every time.
   *
   * Asha P is the fixed input: three days of paid leave still awaiting approval,
   * three days of sick leave already taken, and nothing else on her record.
   */
  it('accrues by the month, against the clock', () => {
    setClock(() => new Date(2026, 5, 30)) // 30 June — half the year gone

    const june = leaveBalance('ap')
    /* 18 a year × 6/12 = 9 earned, 3 of them spoken for by a pending request. */
    expect(june.pl).toEqual({ annual: 18, earned: 9, taken: 0, pending: 3, left: 6 })
    /* 8 a year × 6/12 = 4 earned, 3 taken. */
    expect(june.sl).toEqual({ annual: 8, earned: 4, taken: 3, pending: 0, left: 1 })
  })

  it('shows less of it in March than in June, which is what "accrues" means', () => {
    /* The counter-example. Same person, same leave record, earlier in the year:
       if the entitlement were the flat annual figure these two would agree, and
       the assertion above would be pinning nothing. */
    setClock(() => new Date(2026, 2, 31)) // 31 March

    const march = leaveBalance('ap')
    expect(march.pl.earned, 'the accrual no longer moves with the month').toBe(5)
    expect(march.pl.left).toBe(2)

    /* And three days of sick leave taken against two accrued floors at nothing
       rather than going negative — the case the property test cannot reach,
       because nobody in the seed is overdrawn at the seed clock. */
    expect(march.sl.earned).toBe(2)
    expect(march.sl.taken).toBe(3)
    expect(march.sl.left).toBe(0)
  })
})

describe('a full and final settlement', () => {
  afterEach(resetClock)

  /**
   * Worked out by hand, because a settlement is the one payslip nobody gets to
   * correct next month.
   *
   * Kavitha V leaving on 15 July 2026. Her structure grosses 24,197 over 27
   * working days — 896.19 a day. Fifteen days of a thirty-day month is 14
   * payable days, so 12,547 of salary. Eleven days of paid leave stand to July
   * (18 a year, seven months accrued, none taken) and encash at basic ÷ 26 →
   * 5,588. She joined in April 2025, so at fifteen months served she is under
   * the five-year gratuity threshold and gets nothing for it.
   */
  it('pays salary to the last day and encashes the balance', () => {
    setClock(() => new Date(2026, 6, 15))

    const kavitha = staff.find((p) => p.id === 'kv')!
    const s = settlement(kavitha, new Date(2026, 6, 15))

    expect(s.lines.map(([, amount]) => amount)).toEqual([12_547, 5_588, 0])
    expect(s.total).toBe(18_135)
    expect(s.bal.pl.left).toBe(11)
  })

  it('withholds gratuity under five years, and says why on the line itself', () => {
    setClock(() => new Date(2026, 6, 15))

    const kavitha = staff.find((p) => p.id === 'kv')!
    const s = settlement(kavitha, new Date(2026, 6, 15))

    expect(s.yrs).toBeCloseTo(1.22, 2)
    expect(s.lines[2][0]).toContain('under the five-year threshold')
  })

  it('pays it once the five years are served, which is what makes that a threshold', () => {
    /* The counter-example, made by moving the clock rather than the record: the
       same person, six years on, crosses the threshold and is owed 15 days of
       basic for each of the six completed years — 13,208 × 15 ÷ 26 × 6. */
    setClock(() => new Date(2031, 6, 15))

    const kavitha = staff.find((p) => p.id === 'kv')!
    const s = settlement(kavitha, new Date(2031, 6, 15))

    expect(s.yrs, 'the counter-example no longer crosses the threshold').toBeGreaterThanOrEqual(5)
    expect(s.lines[2][1]).toBe(45_720)
    expect(s.lines[2][0]).toContain('6 completed years')
  })
})

describe('the month a dated record belongs to', () => {
  /*
   * `monthOf` turns a stored MM/DD/YYYY into the "Mon YYYY" label the register
   * is keyed by, and overtime is matched against it. A date it cannot read, and
   * a thirteenth month in a date that parses perfectly well, belong to no month
   * at all — so both get '', the one label no real month carries.
   *
   * That is what keeps them matching nothing: a near-miss label like
   * "undefined 2026" or "Jan NaN" reads like a month and sits next to a real one.
   */
  it('labels a date it can read', () => {
    expect(monthOf('07/15/2026')).toBe('Jul 2026')
    expect(monthOf('01/01/2026')).toBe('Jan 2026')
    expect(monthOf('12/31/2026')).toBe('Dec 2026')
  })

  it('gives no label to a date it cannot read', () => {
    for (const d of ['2026-07-15', '15 July 2026', '', 'never']) {
      expect(monthOf(d), `${d} should belong to no month`).toBe('')
    }
  })

  it('gives no label to a month number that is not a month', () => {
    expect(monthOf('13/01/2026')).toBe('')
    expect(monthOf('00/01/2026')).toBe('')
  })

  it('never returns a label that matches a real month it did not mean', () => {
    /* The point of the empty string: it cannot collide with a pay month, so an
       unreadable overtime record is matched by nothing rather than by whichever
       month a stray "undefined" happened to sit next to. */
    for (const mn of PAYMONTHS) {
      expect(monthOf('2026-07-15')).not.toBe(mn)
    }
  })
})

describe('a punch time with a part missing', () => {
  /* Minutes past midnight, off an HH:MM string. A component that is not there is
     worth none of them, so every shape a punch arrives in reads as a finite
     number: a timesheet can no more show NaN minutes worked than a payslip can
     show NaN rupees. */
  it('reads the parts it has', () => {
    expect(mins('09:30')).toBe(570)
    expect(mins('00:00')).toBe(0)
    expect(mins('23:59')).toBe(1439)
  })

  it('is a number rather than NaN when a part is missing', () => {
    for (const t of ['09', '', 'half nine']) {
      expect(Number.isFinite(mins(t)), `${t} produced ${mins(t)}`).toBe(true)
    }
    expect(mins('09')).toBe(540)
    expect(mins('')).toBe(0)
  })
})

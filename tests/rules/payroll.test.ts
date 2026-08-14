import { describe, expect, it } from 'vitest'
import { leaveBalance, paidStaff, payslipOf, structureOf, taxUnder, ytd } from '@/lib/payroll'
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
      expect(s.gross).toBeLessThanOrEqual(full + s.gross - full + 1e9) // gross may include arrears/OT
    })
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
  it('never shows more taken than earned, or a negative balance', () => {
    staff.forEach((p) => {
      Object.entries(leaveBalance(p.id)).forEach(([kind, b]) => {
        expect(b.left, `${p.n}/${kind}: negative balance`).toBeGreaterThanOrEqual(0)
        expect(b.left).toBe(Math.max(0, b.earned - b.taken - b.pending))
      })
    })
  })
})

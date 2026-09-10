import { afterEach, describe, expect, it } from 'vitest'
import { LOANEVENTS, LOANPAYMENTS, LOANS } from '@/data/loans'
import {
  isRepaid,
  loanDeductionsFor,
  LOAN_POLICY,
  outstanding,
  policyCheck,
  recoveredInMonth,
  scheduleFor,
  statusAfter,
} from '@/lib/loans'
import { resetClock, setClock } from '@/lib/clock'
import type { LoanPayment, LoanRecord } from '@/data/types'

afterEach(resetClock)

const loan = (over: Partial<LoanRecord>): LoanRecord => ({
  id: 'X',
  who: 'us',
  kind: 'loan',
  amt: 30000,
  emi: 5000,
  paid: 0,
  st: 'requested',
  reqAt: new Date(2026, 5, 1),
  note: 'Test',
  ...over,
})

describe('the balance identity', () => {
  /* Everything the register and the schedule show against a loan comes back to
     this one line — if it can drift, "outstanding" is a number somebody typed. */
  it('is amt minus paid, for every seeded loan', () => {
    for (const l of LOANS) {
      expect(outstanding(l)).toBe(Math.max(0, l.amt - l.paid))
    }
  })

  it('never goes negative even if paid overshoots', () => {
    expect(outstanding(loan({ amt: 10000, paid: 12000 }))).toBe(0)
  })

  it('reports fully repaid exactly at the boundary', () => {
    expect(isRepaid(loan({ amt: 10000, paid: 9999 }))).toBe(false)
    expect(isRepaid(loan({ amt: 10000, paid: 10000 }))).toBe(true)
    expect(isRepaid(loan({ amt: 10000, paid: 10001 }))).toBe(true)
  })

  it("carries every seeded loan's paid total on its own payment rows", () => {
    for (const l of LOANS) {
      const sum = LOANPAYMENTS.filter((p) => p.loanId === l.id).reduce((a, p) => a + p.amt, 0)
      expect(sum, `${l.id}`).toBe(l.paid)
    }
  })
})

describe('statusAfter', () => {
  it('approves a requested loan for anyone but its own requester', () => {
    const l = loan({ who: 'us', st: 'requested' })
    expect(statusAfter(l, 'approve', 'hw')).toEqual({ ok: true, st: 'active' })
  })

  /* A test that cannot fail is not a test — this asserts both directions. */
  it('blocks approving or rejecting your own request', () => {
    const l = loan({ who: 'us', st: 'requested' })
    expect(statusAfter(l, 'approve', 'us')).toEqual({ ok: false, reason: expect.any(String) })
    expect(statusAfter(l, 'reject', 'us')).toEqual({ ok: false, reason: expect.any(String) })
  })

  it('rejects a requested loan for a different actor', () => {
    const l = loan({ who: 'us', st: 'requested' })
    expect(statusAfter(l, 'reject', 'hw')).toEqual({ ok: true, st: 'rejected' })
  })

  it('pauses an active loan and resumes a paused one', () => {
    expect(statusAfter(loan({ st: 'active' }), 'pause', 'hw')).toEqual({ ok: true, st: 'paused' })
    expect(statusAfter(loan({ st: 'paused' }), 'resume', 'hw')).toEqual({ ok: true, st: 'active' })
  })

  it('refuses every transition that is not one step forward', () => {
    expect(statusAfter(loan({ st: 'active' }), 'approve', 'hw').ok).toBe(false)
    expect(statusAfter(loan({ st: 'closed' }), 'pause', 'hw').ok).toBe(false)
    expect(statusAfter(loan({ st: 'rejected' }), 'resume', 'hw').ok).toBe(false)
    expect(statusAfter(loan({ st: 'requested' }), 'pause', 'hw').ok).toBe(false)
  })
})

describe('policyCheck', () => {
  it('allows an advance at or under half of monthly net', () => {
    expect(policyCheck('advance', 5000, 20000, 10000, [])).toEqual({ ok: true })
    expect(policyCheck('advance', 5001, 20000, 10000, []).ok).toBe(false)
  })

  it('allows a loan at or under twice monthly gross', () => {
    expect(policyCheck('loan', 40000, 20000, 15000, [])).toEqual({ ok: true })
    expect(policyCheck('loan', 40001, 20000, 15000, []).ok).toBe(false)
  })

  it('blocks a second loan or a second advance for the same person', () => {
    const existing = [loan({ kind: 'loan', st: 'active' })]
    expect(policyCheck('loan', 1000, 100000, 100000, existing).ok).toBe(false)
    expect(policyCheck('advance', 1000, 100000, 100000, existing)).toEqual({ ok: true })
  })

  it('does not count a closed or rejected loan against the concurrency cap', () => {
    const existing = [loan({ kind: 'loan', st: 'closed' }), loan({ id: 'Y', kind: 'loan', st: 'rejected' })]
    expect(policyCheck('loan', 1000, 100000, 100000, existing)).toEqual({ ok: true })
  })

  it(`uses the ${LOAN_POLICY.loanMultipleOfGross}x-gross / ${LOAN_POLICY.advancePctOfNet}%-net figures the Policy panel states`, () => {
    expect(LOAN_POLICY).toEqual({ advancePctOfNet: 50, loanMultipleOfGross: 2 })
  })
})

describe('loanDeductionsFor', () => {
  it("reproduces a past month's recorded recovery rather than recomputing it", () => {
    const deds = loanDeductionsFor('rm', 'Mar 2026', LOANS, LOANPAYMENTS)
    expect(deds).toEqual([{ loan: LOANS.find((l) => l.id === 'L1'), amount: 6000 }])
  })

  it('falls back to a live read, clamped to the balance left, for a month with no recorded payment', () => {
    const l = loan({ id: 'Z', who: 'zz', st: 'active', amt: 10000, emi: 6000, paid: 6000 })
    const deds = loanDeductionsFor('zz', 'Sep 2026', [l], [])
    expect(deds).toEqual([{ loan: l, amount: 4000 }])
  })

  it(
    'shows zero, not a live re-derivation, for someone with nothing due in a month the ledger ' +
      'has already settled for other people',
    () => {
      /* A loan taken mid-month has no row yet for that month even though the
         month itself is already on the ledger via other loans — the live
         "next run" preview must not leak backwards into a settled month. */
      const active = loan({ id: 'Z', who: 'zz', st: 'active', amt: 10000, emi: 6000, paid: 0 })
      const othersPayment: LoanPayment = {
        id: 'PM1',
        loanId: 'W',
        mn: 'Aug 2026',
        amt: 1000,
        at: new Date(2026, 7, 28),
      }
      expect(loanDeductionsFor('zz', 'Aug 2026', [active], [othersPayment])).toEqual([])
    },
  )

  it('sums a concurrent loan and advance for the same person and month', () => {
    const loanRec = loan({ id: 'A', who: 'zz', kind: 'loan', st: 'active', amt: 50000, emi: 6000, paid: 0 })
    const advRec = loan({ id: 'B', who: 'zz', kind: 'advance', st: 'active', amt: 8000, emi: 8000, paid: 0 })
    const deds = loanDeductionsFor('zz', 'Sep 2026', [loanRec, advRec], [])
    expect(deds.reduce((a, d) => a + d.amount, 0)).toBe(14000)
    expect(deds.map((d) => d.loan.kind).sort()).toEqual(['advance', 'loan'])
  })

  it('excludes a paused, requested, closed or rejected loan from the live read', () => {
    const statuses: LoanRecord['st'][] = ['paused', 'requested', 'closed', 'rejected']
    for (const st of statuses) {
      const l = loan({ who: 'zz', st, amt: 10000, emi: 5000, paid: 0 })
      expect(loanDeductionsFor('zz', 'Sep 2026', [l], []), st).toEqual([])
    }
  })

  it('omits a loan that is fully repaid rather than showing a zero line', () => {
    const l = loan({ who: 'zz', st: 'active', amt: 10000, paid: 10000 })
    expect(loanDeductionsFor('zz', 'Sep 2026', [l], [])).toEqual([])
  })
})

describe('scheduleFor', () => {
  it('clamps the final instalment to what is left rather than overshooting', () => {
    const l = loan({ amt: 13000, emi: 5000, takenOn: new Date(2026, 2, 1) })
    const rows = scheduleFor(l, [])
    expect(rows.map((r) => r.amount)).toEqual([5000, 5000, 3000])
  })

  it('marks paid rows from the ledger, the next unpaid one due, and the rest upcoming', () => {
    const l = loan({ id: 'L1', amt: 15000, emi: 5000, takenOn: new Date(2026, 2, 1) })
    const payments: LoanPayment[] = [
      { id: 'PM1', loanId: 'L1', mn: 'Apr 2026', amt: 5000, at: new Date(2026, 3, 28) },
    ]
    const rows = scheduleFor(l, payments)
    expect(rows.map((r) => r.status)).toEqual(['paid', 'due', 'upcoming'])
  })

  it('has no schedule before a loan is taken', () => {
    expect(scheduleFor(loan({ takenOn: undefined }), [])).toEqual([])
  })
})

describe('recoveredInMonth', () => {
  it('matches a hand summation for every seeded month', () => {
    for (const mn of ['Mar 2026', 'Apr 2026', 'May 2026', 'Jun 2026', 'Jul 2026']) {
      const expected = LOANPAYMENTS.filter((p) => p.mn === mn).reduce((a, p) => a + p.amt, 0)
      expect(recoveredInMonth(LOANPAYMENTS, mn)).toBe(expected)
    }
  })

  it('is zero for a month nothing was recovered in', () => {
    expect(recoveredInMonth(LOANPAYMENTS, 'Jan 2026')).toBe(0)
  })
})

describe('seed data', () => {
  it('gives every event a loan that actually exists', () => {
    const ids = new Set(LOANS.map((l) => l.id))
    for (const e of LOANEVENTS) expect(ids.has(e.loanId), e.id).toBe(true)
  })

  it('covers every status the reference tabs need', () => {
    const seen = new Set(LOANS.map((l) => l.st))
    expect(seen).toEqual(new Set(['requested', 'active', 'paused', 'closed', 'rejected']))
  })
})

/* setClock/resetClock are exercised so a later addition of a now()-relative rule
   (e.g. "is this loan overdue for its next instalment") has a clock to pin. */
describe('nextPayrollMonth', () => {
  it('is the calendar month after now()', async () => {
    const { nextPayrollMonth } = await import('@/lib/loans')
    setClock(() => new Date(2026, 7, 3, 17, 30))
    expect(nextPayrollMonth()).toBe('Sep 2026')
  })
})

import { now } from '@/lib/clock'
import type { LoanEvent, LoanKind, LoanPayment, LoanRecord, LoanStatus } from '@/data/types'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const monthLabel = (d: Date) => `${MON[d.getMonth()] ?? ''} ${d.getFullYear()}`
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1)

export const nextPayrollMonth = (): string => monthLabel(addMonths(now(), 1))

export const outstanding = (loan: LoanRecord): number => Math.max(0, loan.amt - loan.paid)

export const isRepaid = (loan: LoanRecord): boolean => loan.paid >= loan.amt

export const openLoansFor = (personId: string, loans: LoanRecord[]): LoanRecord[] =>
  loans.filter((l) => l.who === personId && (l.st === 'active' || l.st === 'paused'))

export interface LoanDeduction {
  loan: LoanRecord
  amount: number
}

export function loanDeductionsFor(
  personId: string,
  mn: string,
  loans: LoanRecord[],
  payments: LoanPayment[],
): LoanDeduction[] {
  const byId = new Map(loans.map((l) => [l.id, l] as const))
  const settled = payments.some((p) => p.mn === mn)
  if (settled) {
    return payments.flatMap((p) => {
      if (p.mn !== mn) return []
      const loan = byId.get(p.loanId)
      if (!loan || loan.who !== personId) return []
      return [{ loan, amount: p.amt }]
    })
  }
  return loans
    .filter((l) => l.who === personId && l.st === 'active')
    .map((l) => ({ loan: l, amount: Math.min(l.emi, outstanding(l)) }))
    .filter((d) => d.amount > 0)
}

export type LoanAction = 'approve' | 'reject' | 'pause' | 'resume'

export type Decision = { ok: true; st: LoanStatus } | { ok: false; reason: string }

const VALID_FROM: Record<LoanAction, { from: LoanStatus; to: LoanStatus }> = {
  approve: { from: 'requested', to: 'active' },
  reject: { from: 'requested', to: 'rejected' },
  pause: { from: 'active', to: 'paused' },
  resume: { from: 'paused', to: 'active' },
}

export function statusAfter(loan: LoanRecord, action: LoanAction, actorId: string): Decision {
  if ((action === 'approve' || action === 'reject') && actorId === loan.who) {
    return { ok: false, reason: 'You cannot decide your own request' }
  }
  const rule = VALID_FROM[action]
  if (loan.st !== rule.from) {
    return { ok: false, reason: `Cannot ${action} a ${loan.kind} that is ${loan.st}` }
  }
  return { ok: true, st: rule.to }
}

export const LOAN_POLICY = { advancePctOfNet: 50, loanMultipleOfGross: 2 } as const

export type PolicyResult = { ok: true } | { ok: false; reason: string }

export function policyCheck(
  kind: LoanKind,
  amount: number,
  monthlyGross: number,
  monthlyNet: number,
  existingForPerson: LoanRecord[],
): PolicyResult {
  const live = existingForPerson.filter((l) => l.st === 'requested' || l.st === 'active' || l.st === 'paused')
  if (live.some((l) => l.kind === kind)) {
    return {
      ok: false,
      reason: `Already has ${kind === 'loan' ? 'a staff loan' : 'a salary advance'} open — one of each at a time`,
    }
  }
  if (kind === 'advance' && amount > monthlyNet * (LOAN_POLICY.advancePctOfNet / 100)) {
    return { ok: false, reason: `Advances are capped at ${LOAN_POLICY.advancePctOfNet}% of monthly net pay` }
  }
  if (kind === 'loan' && amount > monthlyGross * LOAN_POLICY.loanMultipleOfGross) {
    return { ok: false, reason: `Staff loans are capped at ${LOAN_POLICY.loanMultipleOfGross}× monthly gross pay` }
  }
  return { ok: true }
}

export interface ScheduleRow {
  seq: number
  due: string
  amount: number
  status: 'paid' | 'due' | 'upcoming'
  paidOn?: Date
}

export function scheduleFor(loan: LoanRecord, payments: LoanPayment[]): ScheduleRow[] {
  if (!loan.takenOn || loan.emi <= 0) return []
  const mine = payments.filter((p) => p.loanId === loan.id).sort((a, b) => a.at.getTime() - b.at.getTime())
  const count = Math.max(1, Math.ceil(loan.amt / loan.emi))
  const rows: ScheduleRow[] = []
  for (let i = 0; i < count; i++) {
    const amount = i === count - 1 ? loan.amt - loan.emi * (count - 1) : loan.emi
    const paidRow = mine[i]
    const due = monthLabel(addMonths(loan.takenOn, i + 1))
    rows.push(
      paidRow
        ? { seq: i + 1, due, amount, status: 'paid', paidOn: paidRow.at }
        : { seq: i + 1, due, amount, status: i === mine.length ? 'due' : 'upcoming' },
    )
  }
  return rows
}

export const recoveredInMonth = (payments: LoanPayment[], mn: string): number =>
  payments.filter((p) => p.mn === mn).reduce((a, p) => a + p.amt, 0)

export function activityFor(
  loanId: string,
  events: LoanEvent[],
  payments: LoanPayment[],
): { at: Date; kind: 'event' | 'payment'; event?: LoanEvent; payment?: LoanPayment }[] {
  const es = events.filter((e) => e.loanId === loanId).map((e) => ({ at: e.at, kind: 'event' as const, event: e }))
  const ps = payments
    .filter((p) => p.loanId === loanId)
    .map((p) => ({ at: p.at, kind: 'payment' as const, payment: p }))
  return [...es, ...ps].sort((a, b) => b.at.getTime() - a.at.getTime())
}

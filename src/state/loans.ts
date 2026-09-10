import { LOANEVENTS, LOANPAYMENTS, LOANS } from '@/data/loans'
import { createStore, useStore } from '@/lib/store'
import { isRepaid, loanDeductionsFor, statusAfter, type LoanAction, type Decision } from '@/lib/loans'
import { now } from '@/lib/clock'
import type { LoanEvent, LoanKind, LoanPayment, LoanRecord } from '@/data/types'

interface Book {
  loans: LoanRecord[]
  payments: LoanPayment[]
  events: LoanEvent[]
}

const store = createStore<Book>({ loans: LOANS, payments: LOANPAYMENTS, events: LOANEVENTS })

export const useLoans = (): Book => useStore(store)

const nextId = (prefix: string, ids: string[]) =>
  prefix + (ids.reduce((max, id) => Math.max(max, Number(id.replace(new RegExp(`^${prefix}`), '')) || 0), 0) + 1)

export interface RequestInput {
  who: string
  kind: LoanKind
  amt: number
  emi: number
  note: string
}

export function requestLoan(input: RequestInput): LoanRecord {
  const { loans, events } = store.get()
  const loan: LoanRecord = {
    id: nextId('L', loans.map((l) => l.id)),
    who: input.who,
    kind: input.kind,
    amt: input.amt,
    emi: input.emi,
    paid: 0,
    st: 'requested',
    reqAt: now(),
    note: input.note,
  }
  const event: LoanEvent = {
    id: nextId('E', events.map((e) => e.id)),
    loanId: loan.id,
    at: now(),
    by: input.who,
    action: 'requested',
  }
  store.update((b) => ({ ...b, loans: [...b.loans, loan], events: [...b.events, event] }))
  return loan
}

const EVENT_ACTION: Record<LoanAction, LoanEvent['action']> = {
  approve: 'approved',
  reject: 'rejected',
  pause: 'paused',
  resume: 'resumed',
}

export function decide(id: string, action: LoanAction, actorId: string): Decision {
  const loan = store.get().loans.find((l) => l.id === id)
  if (!loan) return { ok: false, reason: 'No such loan' }
  const result = statusAfter(loan, action, actorId)
  if (!result.ok) return result

  const patch: Partial<LoanRecord> =
    action === 'approve'
      ? { st: result.st, decidedBy: actorId, decidedAt: now(), takenOn: now() }
      : action === 'reject'
        ? { st: result.st, decidedBy: actorId, decidedAt: now() }
        : { st: result.st }

  store.update((b) => ({
    ...b,
    loans: b.loans.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    events: [
      ...b.events,
      { id: nextId('E', b.events.map((e) => e.id)), loanId: id, at: now(), by: actorId, action: EVENT_ACTION[action] },
    ],
  }))
  return result
}

export function recoverForRun(mn: string, personIds: string[]): void {
  const { loans, payments, events } = store.get()
  const already = new Set(payments.filter((p) => p.mn === mn).map((p) => p.loanId))
  const newPayments: LoanPayment[] = []
  const newEvents: LoanEvent[] = []

  const updated = loans.map((loan) => {
    if (loan.st !== 'active' || !personIds.includes(loan.who) || already.has(loan.id)) return loan
    const ded = loanDeductionsFor(loan.who, mn, loans, payments).find((d) => d.loan.id === loan.id)
    if (!ded) return loan

    newPayments.push({
      id: nextId('PM', [...payments.map((p) => p.id), ...newPayments.map((p) => p.id)]),
      loanId: loan.id,
      mn,
      amt: ded.amount,
      at: now(),
    })
    const paid = loan.paid + ded.amount
    const next: LoanRecord = isRepaid({ ...loan, paid }) ? { ...loan, paid, st: 'closed' } : { ...loan, paid }
    if (next.st === 'closed') {
      newEvents.push({
        id: nextId('E', [...events.map((e) => e.id), ...newEvents.map((e) => e.id)]),
        loanId: loan.id,
        at: now(),
        by: 'system',
        action: 'closed',
        note: 'Fully repaid',
      })
    }
    return next
  })

  if (!newPayments.length) return
  store.update((b) => ({
    ...b,
    loans: updated,
    payments: [...b.payments, ...newPayments],
    events: [...b.events, ...newEvents],
  }))
}

export const resetLoans = store.reset

import type { LabelMap, LoanEvent, LoanPayment, LoanRecord } from './types'

export const LNSTATUS: LabelMap = {
  requested: ['Requested', 'b'],
  active: ['Active', 'v'],
  paused: ['Paused', 'r'],
  closed: ['Closed', 'n'],
  rejected: ['Rejected', 'd'],
}

export const LNKIND: LabelMap = {
  loan: ['Staff loan', 'n'],
  advance: ['Salary advance', 'b'],
}

export const LOANS: LoanRecord[] = [
  {
    id: 'L1',
    who: 'rm',
    kind: 'loan',
    amt: 60000,
    emi: 6000,
    paid: 30000,
    st: 'active',
    reqAt: new Date(2026, 1, 20),
    decidedBy: 'hw',
    decidedAt: new Date(2026, 1, 25),
    takenOn: new Date(2026, 1, 26),
    note: 'Home repairs',
  },
  {
    id: 'L2',

    who: 'nb',
    kind: 'loan',
    amt: 24000,
    emi: 4000,
    paid: 16000,
    st: 'active',
    reqAt: new Date(2026, 2, 25),
    decidedBy: 'hw',
    decidedAt: new Date(2026, 2, 28),
    takenOn: new Date(2026, 2, 29),
    note: 'Medical expenses',
  },
  {
    id: 'L3',
    who: 'md',
    kind: 'loan',
    amt: 36000,
    emi: 6000,
    paid: 24000,
    st: 'active',
    reqAt: new Date(2026, 2, 20),
    decidedBy: 'hw',
    decidedAt: new Date(2026, 2, 22),
    takenOn: new Date(2026, 2, 23),
    note: "Child's school fees",
  },
  {
    id: 'L4',

    who: 'sm',
    kind: 'advance',
    amt: 12000,
    emi: 12000,
    paid: 0,
    st: 'active',
    reqAt: new Date(2026, 6, 15),
    decidedBy: 'hw',
    decidedAt: new Date(2026, 6, 16),
    takenOn: new Date(2026, 6, 20),
    note: 'Festival advance',
  },
  {
    id: 'L5',
    who: 'dn',
    kind: 'loan',
    amt: 40000,
    emi: 5000,
    paid: 20000,
    st: 'paused',
    reqAt: new Date(2026, 1, 25),
    decidedBy: 'hw',
    decidedAt: new Date(2026, 1, 27),
    takenOn: new Date(2026, 1, 28),
    note: 'Travel expenses',
  },
  {
    id: 'L6',
    who: 'vs',
    kind: 'loan',
    amt: 25000,
    emi: 5000,
    paid: 25000,
    st: 'closed',
    reqAt: new Date(2026, 1, 10),
    decidedBy: 'hw',
    decidedAt: new Date(2026, 1, 12),
    takenOn: new Date(2026, 1, 13),
    note: 'Wedding in the family',
  },
  {
    id: 'L7',
    who: 'tr',
    kind: 'loan',
    amt: 90000,
    emi: 9000,
    paid: 0,
    st: 'rejected',
    reqAt: new Date(2026, 6, 5),
    decidedBy: 'hw',
    decidedAt: new Date(2026, 6, 7),
    note: 'Home renovation',
  },
  {
    id: 'L8',
    who: 'sr',
    kind: 'loan',
    amt: 50000,
    emi: 5000,
    paid: 0,
    st: 'requested',
    reqAt: new Date(2026, 6, 28),
    note: 'Medical expenses',
  },
  {
    id: 'L9',
    who: 'ap',
    kind: 'advance',
    amt: 10000,
    emi: 10000,
    paid: 0,
    st: 'requested',
    reqAt: new Date(2026, 7, 1),
    note: 'Festival advance',
  },
]

const paymentRows: [loanId: string, mn: string, amt: number, at: Date][] = [
  ['L1', 'Mar 2026', 6000, new Date(2026, 2, 28)],
  ['L1', 'Apr 2026', 6000, new Date(2026, 3, 28)],
  ['L1', 'May 2026', 6000, new Date(2026, 4, 28)],
  ['L1', 'Jun 2026', 6000, new Date(2026, 5, 28)],
  ['L1', 'Jul 2026', 6000, new Date(2026, 6, 28)],

  ['L2', 'Apr 2026', 4000, new Date(2026, 3, 28)],
  ['L2', 'May 2026', 4000, new Date(2026, 4, 28)],
  ['L2', 'Jun 2026', 4000, new Date(2026, 5, 28)],
  ['L2', 'Jul 2026', 4000, new Date(2026, 6, 28)],

  ['L3', 'Apr 2026', 6000, new Date(2026, 3, 28)],
  ['L3', 'May 2026', 6000, new Date(2026, 4, 28)],
  ['L3', 'Jun 2026', 6000, new Date(2026, 5, 28)],
  ['L3', 'Jul 2026', 6000, new Date(2026, 6, 28)],

  ['L5', 'Mar 2026', 5000, new Date(2026, 2, 28)],
  ['L5', 'Apr 2026', 5000, new Date(2026, 3, 28)],
  ['L5', 'May 2026', 5000, new Date(2026, 4, 28)],
  ['L5', 'Jun 2026', 5000, new Date(2026, 5, 28)],

  ['L6', 'Mar 2026', 5000, new Date(2026, 2, 28)],
  ['L6', 'Apr 2026', 5000, new Date(2026, 3, 28)],
  ['L6', 'May 2026', 5000, new Date(2026, 4, 28)],
  ['L6', 'Jun 2026', 5000, new Date(2026, 5, 28)],
  ['L6', 'Jul 2026', 5000, new Date(2026, 6, 28)],
]

export const LOANPAYMENTS: LoanPayment[] = paymentRows.map(([loanId, mn, amt, at], i) => ({
  id: `PM${i + 1}`,
  loanId,
  mn,
  amt,
  at,
}))

export const LOANEVENTS: LoanEvent[] = [
  { id: 'E1', loanId: 'L1', at: new Date(2026, 1, 20), by: 'rm', action: 'requested' },
  { id: 'E2', loanId: 'L1', at: new Date(2026, 1, 25), by: 'hw', action: 'approved' },

  { id: 'E3', loanId: 'L2', at: new Date(2026, 2, 25), by: 'nb', action: 'requested' },
  { id: 'E4', loanId: 'L2', at: new Date(2026, 2, 28), by: 'hw', action: 'approved' },

  { id: 'E5', loanId: 'L3', at: new Date(2026, 2, 20), by: 'md', action: 'requested' },
  { id: 'E6', loanId: 'L3', at: new Date(2026, 2, 22), by: 'hw', action: 'approved' },

  { id: 'E7', loanId: 'L4', at: new Date(2026, 6, 15), by: 'sm', action: 'requested' },
  { id: 'E8', loanId: 'L4', at: new Date(2026, 6, 16), by: 'hw', action: 'approved' },

  { id: 'E9', loanId: 'L5', at: new Date(2026, 1, 25), by: 'dn', action: 'requested' },
  { id: 'E10', loanId: 'L5', at: new Date(2026, 1, 27), by: 'hw', action: 'approved' },
  {
    id: 'E11',
    loanId: 'L5',
    at: new Date(2026, 6, 2),
    by: 'hw',
    action: 'paused',
    note: 'Paused while on unpaid leave',
  },

  { id: 'E12', loanId: 'L6', at: new Date(2026, 1, 10), by: 'vs', action: 'requested' },
  { id: 'E13', loanId: 'L6', at: new Date(2026, 1, 12), by: 'hw', action: 'approved' },
  { id: 'E14', loanId: 'L6', at: new Date(2026, 6, 30), by: 'hw', action: 'closed', note: 'Fully repaid' },

  { id: 'E15', loanId: 'L7', at: new Date(2026, 6, 5), by: 'tr', action: 'requested' },
  {
    id: 'E16',
    loanId: 'L7',
    at: new Date(2026, 6, 7),
    by: 'hw',
    action: 'rejected',
    note: 'Exceeds the loan cap for this pay band',
  },

  { id: 'E17', loanId: 'L8', at: new Date(2026, 6, 28), by: 'sr', action: 'requested' },
  { id: 'E18', loanId: 'L9', at: new Date(2026, 7, 1), by: 'ap', action: 'requested' },
]

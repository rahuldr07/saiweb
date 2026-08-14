/**
 * Salary derives from one number — the CTC on a person's record — through a
 * structure that follows the 50% wage rule in the labour codes. Everything on a
 * payslip falls out of that, attendance, and the statutory settings. Nothing is
 * typed twice.
 */
import {
  ARREARS,
  ATT,
  CLAIMS,
  LOANS,
  MONTHDAYS,
  OLDSLABS,
  OLDSTD,
  OT,
  PAYCFG,
  PAYMONTHS,
  STDDED,
  TAXSLABS,
  TIMECFG,
  LEAVE,
  LEAVETYPES,
} from '@/data/hrms'
import { STAFF } from '@/data/people'
import { pad } from './format'
import { now } from '@/lib/clock'
import type { Person } from '@/data/types'

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const inr = (n: number) => PAYCFG.sym + Math.round(n).toLocaleString('en-IN')
export const inr2 = (n: number) =>
  PAYCFG.sym +
  (Math.round(n * 100) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

/* ── the structure ──────────────────────────────────────────────────────── */

export interface Structure {
  ctc: number
  monthly: number
  basic: number
  hra: number
  special: number
  gross: number
  epfEr: number
  grat: number
  pfWage: number
}

/** One CTC in, a full structure out. */
export function structureOf(p: Pick<Person, 'ctc'>): Structure {
  const ctc = p.ctc ?? 0
  const m = ctc / 12
  const basic = Math.round((m * PAYCFG.basicPct) / 100)
  const hra = Math.round((basic * PAYCFG.hraPctOfBasic) / 100)
  const pfWage = PAYCFG.pfOnFullBasic ? basic : Math.min(basic, PAYCFG.pfWageCeiling)
  const epfEr = Math.round((pfWage * PAYCFG.pfPct) / 100)
  const grat = Math.round((basic * PAYCFG.gratuityPct) / 100)
  /* CTC = gross + employer PF + gratuity, so special allowance is the balance. */
  const special = Math.max(0, Math.round(m - epfEr - grat - basic - hra))
  return { ctc, monthly: Math.round(m), basic, hra, special, gross: basic + hra + special, epfEr, grat, pfWage }
}

/* ── tax ────────────────────────────────────────────────────────────────── */

function slabTax(ti: number, slabs: [number, number][], rebateUnder: number): number {
  let tax = 0
  let prev = 0
  for (const [cap, rate] of slabs) {
    if (ti > prev) tax += ((Math.min(ti, cap) - prev) * rate) / 100
    prev = cap
    if (ti <= cap) break
  }
  if (ti <= rebateUnder) tax = 0 // 87A rebate
  return Math.round(tax * 1.04) // + 4% cess
}

/**
 * The old regime still exists, and for anyone with real deductions it can win.
 * Which one applies is the employee's choice, so it is theirs to make.
 */
export function taxUnder(regime: 'new' | 'old', gross12: number, declared = 0): number {
  if (regime === 'new') return slabTax(Math.max(0, gross12 - STDDED), TAXSLABS, 1200000)
  return slabTax(Math.max(0, gross12 - OLDSTD - declared), OLDSLABS, 500000)
}

export const annualTax = (gross12: number) => taxUnder('new', gross12)

/* ── attendance and overtime ────────────────────────────────────────────── */

export const monthOf = (mmddyyyy: string) => {
  const [m, , y] = mmddyyyy.split('/').map(Number)
  return `${MON[m - 1]} ${y}`
}

export const otMinsFor = (id: string, mn: string) =>
  OT.filter((o) => o.who === id && o.st === 'approved' && monthOf(o.d) === mn).reduce((a, o) => a + o.mins, 0)

/** Overtime pays at the ordinary hourly rate, derived from the month's gross. */
export function otPay(p: Person, mn: string): number {
  const mins = otMinsFor(p.id, mn)
  if (!mins) return 0
  const s = structureOf(p)
  const a = ATT[mn]?.[p.id]
  const perHour = s.gross / Math.max(1, a?.working ?? 26) / 8
  return Math.round(perHour * (mins / 60) * TIMECFG.otRate)
}

/** How many of the month's working days this person was actually employed for. */
export function payableDays(p: Person, mn: string, working: number): number {
  if (!p.doj) return working
  const [m, d, y] = p.doj.split('/').map(Number)
  const [mon, yr] = mn.split(' ')
  const mi = MON.indexOf(mon) + 1
  if (y > +yr || (y === +yr && m > mi)) return 0 // had not joined yet
  if (y < +yr || (y === +yr && m < mi)) return working // here for the whole month
  const days = MONTHDAYS[mn]
  return Math.max(0, Math.round((working * (days - d + 1)) / days))
}

/* ── claims, loans, arrears ─────────────────────────────────────────────── */

export const claimsFor = (id: string, mn: string) =>
  CLAIMS.filter((c) => c.who === id && c.mn === mn && c.st !== 'rejected' && c.st !== 'pending')

export const arrearsFor = (id: string, mn: string) => ARREARS.filter((a) => a.who === id && a.mn === mn)

export const loanFor = (id: string) => LOANS.find((l) => l.who === id && l.paid < l.amt)

/* ── one payslip ────────────────────────────────────────────────────────── */

export interface Payslip {
  p: Person
  mn: string
  st: Structure
  unpaid: number
  lopAmt: number
  earn: [string, number][]
  ded: [string, number][]
  reimb: [string, number][]
  employer: [string, number][]
  gross: number
  epf: number
  esi: number
  pt: number
  tds: number
  totalDed: number
  claims: number
  net: number
}

export function payslipOf(p: Person, mn: string): Payslip {
  const st = structureOf(p)
  const a = ATT[mn]?.[p.id] ?? {
    days: 30,
    working: 26,
    hol: 0,
    lop: 0,
    paidLeave: 0,
    payable: 26,
    joined: false,
    present: 26,
  }
  const perDay = st.gross / a.working
  /* Unpaid days, plus any part of the month before they joined. */
  const unpaid = a.lop + Math.max(0, a.working - (a.payable ?? a.working))
  const lopAmt = Math.round(perDay * unpaid)
  const f = a.working ? 1 - unpaid / a.working : 1

  const basic = Math.round(st.basic * f)
  const hra = Math.round(st.hra * f)
  const special = Math.round(st.special * f)
  const gross = basic + hra + special

  const pfWage = PAYCFG.pfOnFullBasic ? basic : Math.min(basic, PAYCFG.pfWageCeiling)
  const epf = Math.round((pfWage * PAYCFG.pfPct) / 100)
  const esi = gross <= PAYCFG.esiGrossLimit ? Math.round((gross * PAYCFG.esiPct) / 100) : 0
  const pt = gross > 0 ? PAYCFG.ptAmount : 0
  const tds = Math.round(taxUnder(PAYCFG.regime, st.gross * 12) / 12)

  const arr = arrearsFor(p.id, mn).reduce((acc, x) => acc + x.amt, 0)
  const cl = claimsFor(p.id, mn).reduce((acc, x) => acc + x.amt, 0)
  const ln = loanFor(p.id)
  const emi = ln ? Math.min(ln.emi, ln.amt - ln.paid) : 0
  const ded = epf + esi + pt + tds + emi

  const ot = otPay(p, mn)
  const otm = otMinsFor(p.id, mn)

  const earn: [string, number][] = [
    ['Basic', basic],
    ['House rent allowance', hra],
    ['Special allowance', special],
  ]
  if (ot) earn.push([`Overtime — ${Math.floor(otm / 60)}h ${pad(otm % 60)}m approved`, ot])
  if (arr) earn.push([`Arrears — ${arrearsFor(p.id, mn)[0].what}`, arr])

  const dedRows: [string, number][] = [
    ['Provident fund (employee)', epf],
    [`Professional tax — ${PAYCFG.ptState}`, pt],
  ]
  if (esi) dedRows.push(['ESI (employee)', esi])
  dedRows.push(['Income tax (TDS)', tds])
  if (emi) dedRows.push(['Advance recovered', emi])

  const grossPay = gross + arr + ot
  return {
    p,
    mn,
    st,
    unpaid,
    lopAmt,
    earn,
    ded: dedRows,
    reimb: claimsFor(p.id, mn).map((c) => [c.what, c.amt] as [string, number]),
    employer: [
      ['Provident fund (employer)', st.epfEr],
      ['Gratuity provision', st.grat],
    ],
    gross: grossPay,
    epf,
    esi,
    pt,
    tds,
    totalDed: ded,
    claims: cl,
    net: grossPay - ded + cl,
  }
}

/** Year to date, for the payslip footer — the figure people actually check. */
export function ytd(p: Person, mn: string) {
  const upto = PAYMONTHS.slice(0, PAYMONTHS.indexOf(mn) + 1)
  return upto.reduce(
    (acc, m) => {
      const s = payslipOf(p, m)
      acc.gross += s.gross
      acc.ded += s.totalDed
      acc.net += s.net
      acc.tds += s.tds
      return acc
    },
    { gross: 0, ded: 0, net: 0, tds: 0 },
  )
}

export const paidStaff = () => STAFF.filter((x) => x.active !== false && x.ctc)

/* ── leave balances ─────────────────────────────────────────────────────── */

export interface Balance {
  earned: number
  taken: number
  pending: number
  left: number
  annual: number
}

export function leaveBalance(pid: string): Record<string, Balance> {
  const out: Record<string, Balance> = {}
  LEAVETYPES.forEach((t) => {
    const taken = LEAVE.filter((l) => l.who === pid && l.type === t.k && l.st === 'approved').reduce(
      (a, l) => a + l.days,
      0,
    )
    const pending = LEAVE.filter((l) => l.who === pid && l.type === t.k && l.st === 'pending').reduce(
      (a, l) => a + l.days,
      0,
    )
    /* Comp-off is earned by working a rest day, so it is counted, not accrued. */
    const earned =
      t.k === 'co'
        ? LEAVE.filter((l) => l.who === pid && l.type === 'co').length + 2
        : Math.round((t.annual * (now().getMonth() + 1)) / 12)
    out[t.k] = { earned, taken, pending, left: Math.max(0, earned - taken - pending), annual: t.annual }
  })
  return out
}

/* ── exit ───────────────────────────────────────────────────────────────── */

export function yearsServed(p: Person): number | null {
  if (!p.doj) return null
  const [m, d, y] = p.doj.split('/').map(Number)
  return (now().getTime() - new Date(y, m - 1, d).getTime()) / (365.25 * 24 * 3600 * 1000)
}

/** Fifteen days of last-drawn basic per completed year, after five. */
export function settlement(p: Person, lastDay?: Date) {
  const st = structureOf(p)
  const a = ATT[PAYMONTHS[PAYMONTHS.length - 1]]?.[p.id]
  const yrs = yearsServed(p)
  const perDay = st.gross / Math.max(1, a?.working ?? 26)
  const dayOfMonth = lastDay ? lastDay.getDate() : now().getDate()
  const salary = Math.round(perDay * Math.round(((a?.working ?? 26) * dayOfMonth) / 30))
  const bal = leaveBalance(p.id)
  const encash = Math.round((bal.pl.left * st.basic) / 26)
  const grat = yrs !== null && yrs >= 5 ? Math.round(((st.basic * 15) / 26) * Math.floor(yrs)) : 0
  const ln = loanFor(p.id)
  const advance = ln ? -(ln.amt - ln.paid) : 0

  const lines: [string, number][] = [
    ['Salary to the last working day', salary],
    [`Leave encashment — ${bal.pl.left} day${bal.pl.left === 1 ? '' : 's'} of paid leave`, encash],
    [
      yrs === null
        ? 'Gratuity — no joining date on record'
        : yrs < 5
          ? `Gratuity — ${yrs.toFixed(1)} years served, under the five-year threshold`
          : `Gratuity — ${Math.floor(yrs)} completed years at 15 days of basic`,
      grat,
    ],
  ]
  if (advance) lines.push(['Advance outstanding, recovered', advance])

  return { lines, yrs, total: lines.reduce((a2, l) => a2 + l[1], 0), st, bal }
}

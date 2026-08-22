/**
 * The two payroll CSVs, in one place.
 *
 * Each is offered from more than one screen — the run offers the register, the
 * payslip document offers itself, and the payslips register offers both. They
 * were built inline at each site, which is two copies of a column list that has
 * to agree with a third. Building the rows here means an export cannot drift
 * from the screen that offered it.
 */
import type { Person } from '@/data/types'
import type { CsvRow } from './csv'
import { payslipOf, words, ytd, type Payslip } from './payroll'

/**
 * The month's register: one row per person, on the figures the run was approved
 * on. Takes the list rather than the month so a caller that has already computed
 * the totals does not compute them twice.
 */
export function registerRows(list: Payslip[]): CsvRow[] {
  return [
    ['Name', 'Department', 'Unpaid days', 'Gross', 'PF', 'PT', 'ESI', 'TDS', 'Net pay'],
    ...list.map((x) => [
      x.p.n,
      x.p.dep[0] ?? '',
      x.lopDays,
      x.gross,
      x.epf,
      x.pt,
      x.esi,
      x.tds,
      x.net,
    ]),
  ]
}

/** One payslip, laid out as the document itself states it. */
export function payslipRows(person: Person, month: string, company: string): CsvRow[] {
  const s = payslipOf(person, month)
  const y = ytd(person, month)
  return [
    ['Payslip', company, month],
    [],
    ['Employee', person.n],
    ['Employee ID', person.id.toUpperCase()],
    ['Department', person.dep.join(', ')],
    ['Working days', s.a.working],
    ['Paid leave', s.a.paidLeave],
    ['Unpaid days', s.a.lop],
    [],
    ['Earnings', 'Amount'],
    ...s.earn,
    ['Gross earnings', s.gross],
    [],
    ['Deductions', 'Amount'],
    ...s.ded,
    ['Total deductions', s.totalDed],
    [],
    ['Net pay', s.net],
    ['In words', words(s.net)],
    [],
    ['Employer contributions', ''],
    ...s.employer,
    [],
    ['Year to date gross', y.gross],
    ['Year to date deductions', y.ded],
    ['Year to date net', y.net],
  ]
}

/** `payslip-Uma-Sankar-Jul-2026`, the stem the design's downloads use. */
export const payslipFileStem = (person: Person, month: string) =>
  `payslip-${person.n.replace(/\s+/g, '-')}-${month.replace(' ', '-')}`

/** `payroll-register-Jul-2026`. */
export const registerFileStem = (month: string) => `payroll-register-${month.replace(' ', '-')}`

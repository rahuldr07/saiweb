/**
 * Scoping the invoice register.
 *
 * There is one filter with two faces: a month dropdown and a pair of dates. The
 * dropdown is a shortcut that sets the dates, and the dates report back which
 * month they happen to match — so the two controls can never contradict each
 * other, which is the failure this arrangement exists to prevent.
 */
import { INVOICES } from '@/data/business'
import type { Invoice } from '@/data/types'

/** The months invoices actually exist for, in order, rather than a hardcoded list. */
export const INVOICE_MONTHS: string[] = [
  ...new Map(
    [...INVOICES].sort((a, b) => a.mi - b.mi).map((i) => [i.m, i.mi] as const),
  ).keys(),
]

/** `<input type="date">` wants YYYY-MM-DD whatever the app displays. */
export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export const parseIso = (v: string): Date => {
  const [y, m, d] = v.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** First and last day of a labelled month, as ISO dates. */
export function monthBounds(month: string): [string, string] {
  const i = INVOICE_MONTHS.indexOf(month)
  if (i < 0) return ['', '']
  const first = new Date(2026, 2 + i, 1)
  const last = new Date(2026, 3 + i, 0)
  return [iso(first), iso(last)]
}

export interface DateRange {
  from: string | null
  to: string | null
}

export const EMPTY_RANGE: DateRange = { from: null, to: null }

/** Filters on the issue date. An open end means open — not "today". */
export function inRange(i: Invoice, { from, to }: DateRange): boolean {
  if (!from && !to) return true
  if (from && i.issued < parseIso(from)) return false
  if (to) {
    const end = parseIso(to)
    end.setHours(23, 59, 59)
    if (i.issued > end) return false
  }
  return true
}

/** Which month the range exactly matches, or `custom`, or `all`. */
export function rangeMonth({ from, to }: DateRange): string {
  if (!from && !to) return 'all'
  for (const m of INVOICE_MONTHS) {
    const [a, b] = monthBounds(m)
    if (a === from && b === to) return m
  }
  return 'custom'
}

/** A month's columns are dimmed and excluded when the range has cut them out. */
export function monthInRange(month: string, range: DateRange): boolean {
  const [a, b] = monthBounds(month)
  return (!range.from || b >= range.from) && (!range.to || a <= range.to)
}

/**
 * A range from a month, keeping the two controls in step.
 *
 * `all` clears the dates rather than widening them, because "every month" and
 * "a range that happens to cover every month" read differently on the screen.
 */
export function rangeForMonth(month: string): DateRange {
  if (month === 'all' || month === 'custom') return EMPTY_RANGE
  const [from, to] = monthBounds(month)
  return { from, to }
}

/** Reversed dates are swapped rather than shown as nothing. */
export function normalise(range: DateRange): DateRange {
  const { from, to } = range
  return from && to && from > to ? { from: to, to: from } : range
}

export const RANGE_PRESETS: [label: string, range: DateRange][] = [
  ['All time', EMPTY_RANGE],
  ['This month', rangeForMonth(INVOICE_MONTHS[INVOICE_MONTHS.length - 1])],
  [
    'Last 3 months',
    {
      from: monthBounds(INVOICE_MONTHS[Math.max(0, INVOICE_MONTHS.length - 3)])[0],
      to: monthBounds(INVOICE_MONTHS[INVOICE_MONTHS.length - 1])[1],
    },
  ],
  [
    'Year to date',
    {
      from: monthBounds(INVOICE_MONTHS[0])[0],
      to: monthBounds(INVOICE_MONTHS[INVOICE_MONTHS.length - 1])[1],
    },
  ],
]

export const sameRange = (a: DateRange, b: DateRange) =>
  (a.from ?? null) === (b.from ?? null) && (a.to ?? null) === (b.to ?? null)

/* ── money ──────────────────────────────────────────────────────────────── */

/** Cents, not floats. Summing invoice lines otherwise drifts by a penny. */
export const r2 = (n: number) => Math.round(n * 100) / 100

export const sumBy = (list: Invoice[], k: 'amt' | 'paid') =>
  r2(list.reduce((a, x) => a + x[k], 0))

export const balance = (i: Invoice) => r2(i.amt - i.paid)

export const outstandingOf = (list: Invoice[]) => r2(sumBy(list, 'amt') - sumBy(list, 'paid'))

/**
 * The petty cash box.
 *
 * One rule runs through all of it: **previous + credit − debit = new balance**,
 * computed from the entries rather than stored. There is nowhere to type a
 * balance, which is what makes a mistake visible on the row where it was made
 * instead of at the month end.
 *
 * A count is kept separate from the ledger on purpose. The ledger says what
 * should be in the box; a count says what was actually in it. Recording them as
 * one number is how a discrepancy stops existing.
 */
import type { PettyConfig, PettyCount, PettyEntry } from '@/data/types'
import { now } from './clock'

/** An entry with the balance either side of it. */
export interface LedgerRow extends PettyEntry {
  before: number
  after: number
}

/** Oldest first, with the running balance derived. */
export function pettyLedger(entries: PettyEntry[]): LedgerRow[] {
  let bal = 0
  return [...entries]
    .sort((a, b) => a.d.getTime() - b.d.getTime())
    .map((e) => {
      const before = bal
      bal = e.kind === 'credit' ? bal + e.amt : bal - e.amt
      return { ...e, before, after: bal }
    })
}

/** What the box should hold, on paper. */
export const pettyBalance = (entries: PettyEntry[]): number => {
  const l = pettyLedger(entries)
  return l.length ? l[l.length - 1].after : 0
}

/** What the ledger said at a given moment — what a count on that day should have found. */
export function expectedAt(entries: PettyEntry[], at: Date): number {
  const upto = pettyLedger(entries).filter((e) => e.d <= at)
  return upto.length ? upto[upto.length - 1].after : 0
}

/** The most recent count, or null if nobody has ever counted it. */
export const lastCount = (counts: PettyCount[]): PettyCount | null =>
  [...counts].sort((a, b) => b.d.getTime() - a.d.getTime())[0] ?? null

/** Whole days between then and now. */
export const daysSince = (d: Date): number =>
  Math.floor((now().getTime() - d.getTime()) / 86_400_000)

/**
 * Whether the box is overdue a count. Never counted is always due — an
 * uncounted box is the one most worth counting.
 */
export function countDue(counts: PettyCount[], cfg: PettyConfig): boolean {
  const c = lastCount(counts)
  if (!c) return true
  return daysSince(c.d) >= (cfg.countEvery === 'week' ? 7 : 30)
}

/** Debits with nothing to show for them — the first thing an auditor asks about. */
export const unvouched = (entries: PettyEntry[]): PettyEntry[] =>
  entries.filter((e) => e.kind === 'debit' && !e.receipt)

/** Debits above the cash ceiling, which should have gone by bank transfer. */
export const overCeiling = (entries: PettyEntry[], cfg: PettyConfig): PettyEntry[] =>
  entries.filter((e) => e.kind === 'debit' && e.amt > cfg.limit)

/** Debits inside the trailing window the screen reports on. */
export const spentWithin = (entries: PettyEntry[], days = 30): PettyEntry[] =>
  entries.filter((e) => e.kind === 'debit' && daysSince(e.d) <= days)

export const total = (entries: PettyEntry[]): number => entries.reduce((a, e) => a + e.amt, 0)

/** A count against what the ledger expected: positive is over, negative is short. */
export const countDrift = (count: PettyCount, entries: PettyEntry[]): number =>
  count.counted - expectedAt(entries, count.d)

import type { PettyConfig, PettyCount, PettyEntry } from '@/data/types'
import { daysSince } from '@/lib/format'

export interface LedgerRow extends PettyEntry {
  before: number
  after: number
}

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

export const pettyBalance = (entries: PettyEntry[]): number => {
  const l = pettyLedger(entries)
  return l[l.length - 1]?.after ?? 0
}

export function expectedAt(entries: PettyEntry[], at: Date): number {
  const upto = pettyLedger(entries).filter((e) => e.d <= at)
  return upto[upto.length - 1]?.after ?? 0
}

export const lastCount = (counts: PettyCount[]): PettyCount | null =>
  [...counts].sort((a, b) => b.d.getTime() - a.d.getTime())[0] ?? null

export function countDue(counts: PettyCount[], cfg: PettyConfig): boolean {
  const c = lastCount(counts)
  if (!c) return true
  return daysSince(c.d) >= (cfg.countEvery === 'week' ? 7 : 30)
}

export const unvouched = (entries: PettyEntry[]): PettyEntry[] =>
  entries.filter((e) => e.kind === 'debit' && !e.receipt)

export const overCeiling = (entries: PettyEntry[], cfg: PettyConfig): PettyEntry[] =>
  entries.filter((e) => e.kind === 'debit' && e.amt > cfg.limit)

export const spentWithin = (entries: PettyEntry[], days = 30): PettyEntry[] =>
  entries.filter((e) => e.kind === 'debit' && daysSince(e.d) <= days)

export const total = (entries: PettyEntry[]): number => entries.reduce((a, e) => a + e.amt, 0)

export const countDrift = (count: PettyCount, entries: PettyEntry[]): number =>
  count.counted - expectedAt(entries, count.d)

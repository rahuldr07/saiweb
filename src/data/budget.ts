/* Values from the Claude Design "Title CRM 897". */
import type { ChipKind } from './types'

/**
 * The small constants that used to live at the end of `quality.ts`.
 *
 * They were moved out because of what importing them cost. `lib/sla.ts` needs
 * `BUDGET` — twenty lines — and reached into the same module as the 767
 * delivery records, so the Orders register, the order detail, Company and Leads
 * each pulled 348 KB of history none of them read. Splitting the file is the
 * whole fix: the history now loads only on the two screens that report on it.
 *
 * The rule this encodes: a module holding bulk data should export nothing else,
 * because every constant beside it becomes a reason to load all of it.
 */

/** Percentage of orders expected to beat their SLA. */
export const ONTIMETARGET = 98

/** One turnaround promise: a client, a product, and the hours. */
export interface SlaRule {
  cl: string
  pr: string
  h: number
}

/**
 * Client + product overrides, falling through to the default rule.
 *
 * Seed data lives here rather than beside the rules that read it: the Company
 * screen edits these through a store, and the store cannot import from `lib/sla`
 * without the two forming a cycle.
 */
export const SLA: SlaRule[] = [
  { cl: 'MGR', pr: 'LIEN', h: 24 },
  { cl: 'MGR', pr: 'PRLP', h: 24 },
  { cl: 'MGR', pr: 'Update', h: 24 },
  { cl: 'CSS', pr: 'PRLP', h: 24 },
  { cl: 'CSS', pr: 'TOS', h: 24 },
  { cl: 'CSS', pr: 'COS', h: 48 },
  { cl: 'NJ', pr: 'COS', h: 24 },
  { cl: '—  (default)', pr: 'Any', h: 24 },
]

/** Share of an order's budget each stage gets, and the per-product overrides. */
export const BUDGET: {
  buffer: number
  base: Record<string, number>
  over: { pr: string; shares: Record<string, number> }[]
} = {
  buffer: 10,
  base: { Search: 50, 'Search QC': 11, Typing: 25, 'Typing QC': 10, RTS: 4 },
  over: [
    { pr: '40Y', shares: { Search: 62, 'Search QC': 10, Typing: 18, 'Typing QC': 7, RTS: 3 } },
    { pr: 'FS+', shares: { Search: 60, 'Search QC': 10, Typing: 20, 'Typing QC': 7, RTS: 3 } },
  ],
}

/** Lead pipeline states, and the chip each one is shown as. */
export const LSTATUS: Record<string, [string, ChipKind]> = {
  new: ['New', 'n'],
  contacted: ['Contacted', 'b'],
  interested: ['Interested', 'r'],
  notnow: ['Not now', 'n'],
  won: ['Won', 'v'],
  lost: ['Lost', 'd'],
}

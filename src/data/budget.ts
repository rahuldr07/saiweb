import type { ChipKind } from './types'

export const ONTIMETARGET = 98

export interface SlaRule {
  cl: string
  pr: string
  h: number
}

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

export const LSTATUS: Record<string, [string, ChipKind]> = {
  new: ['New', 'n'],
  contacted: ['Contacted', 'b'],
  interested: ['Interested', 'r'],
  notnow: ['Not now', 'n'],
  won: ['Won', 'v'],
  lost: ['Lost', 'd'],
}

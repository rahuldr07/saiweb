import { ASSIGN_STAGES } from '@/data/org'
import { checkpoints } from './sla'
import { median } from './metrics'
import type { Delivery } from '@/data/deliveries'
import type { QcEntry } from '@/data/quality'
import type { ChipKind } from '@/data/types'

/**
 * How a person performed, on both axes at once.
 *
 * A quality score on its own is half a picture: somebody can hold a 5.00 by
 * taking twice the time they were given, and somebody fast can be quietly
 * leaving defects. The two have to be read together, so they are computed
 * together.
 */

export interface StageItem {
  d: Delivery
  st: string
  h: number
  budget: number
  ratio: number
  over: boolean
}

export interface StageWork {
  n: string
  items: StageItem[]
  stages: Record<string, StageItem[]>
  /** Stages of work done in range. */
  c: number
  over: number
  onBudget: number
  ratio: number
  causedLate: number
  /** What somebody doing this exact mix of stages would typically manage. */
  expected: number
  vsPeers: number
  /** A good median with a poor hit rate means variance, not slowness. */
  erratic: boolean
}

export interface StageWorkResult {
  people: Record<string, StageWork>
  /** Per-department hit rate, used to make the comparison fair. */
  dept: Record<string, { n: number; over: number; rate: number }>
}

export function stageWorkOf(dels: Delivery[]): StageWorkResult {
  const m: Record<string, StageWork> = {}

  dels.forEach((d) => {
    const plan = checkpoints(d.slaH, d.pr)
    ASSIGN_STAGES.forEach((st) => {
      const name = d.byName?.[st]
      if (!name) return
      const c = plan.find((y) => y.stage === st)
      if (!c?.hours) return
      const h = d.st[st]
      m[name] ??= {
        n: name,
        items: [],
        stages: {},
        c: 0,
        over: 0,
        onBudget: 0,
        ratio: 0,
        causedLate: 0,
        expected: 0,
        vsPeers: 0,
        erratic: false,
      }
      const rec: StageItem = { d, st, h, budget: c.hours, ratio: h / c.hours, over: h > c.hours }
      m[name].items.push(rec)
      ;(m[name].stages[st] ??= []).push(rec)
    })
  })

  /*
   * Departments are not equally hard to hit. RTS almost never overruns; Search
   * routinely does. Judging a searcher against an RTS clerk's percentage would
   * compare the job, not the person — so each person is measured against the
   * departments they actually worked in.
   */
  const dept: Record<string, { n: number; over: number; rate: number }> = {}
  Object.values(m).forEach((p) =>
    p.items.forEach((x) => {
      dept[x.st] ??= { n: 0, over: 0, rate: 0 }
      dept[x.st].n++
      if (x.over) dept[x.st].over++
    }),
  )
  Object.keys(dept).forEach((k) => {
    dept[k].rate = Math.round(((dept[k].n - dept[k].over) / dept[k].n) * 100)
  })

  Object.values(m).forEach((p) => {
    p.c = p.items.length
    p.over = p.items.filter((x) => x.over).length
    p.onBudget = Math.round(((p.c - p.over) / p.c) * 100)
    p.ratio = median(p.items.map((x) => x.ratio))
    /* Only counts against the person if their own stage was the one that overran. */
    p.causedLate = p.items.filter((x) => x.over && x.d.late).length
    p.expected = Math.round(
      ASSIGN_STAGES.reduce((a, st) => {
        const n = (p.stages[st] ?? []).length
        return a + n * (dept[st]?.rate ?? 100)
      }, 0) / p.c,
    )
    p.vsPeers = p.onBudget - p.expected
    p.erratic = p.ratio <= 1.02 && p.onBudget < 65
  })

  return { people: m, dept }
}

/** The plain-English read of the two axes together. */
export function standing(q: number, vsPeers: number, teamQ: number): [string, ChipKind, string] {
  const clean = q >= teamQ - 0.03
  const quick = vsPeers >= -5
  if (clean && quick) return ['Fast and clean', 'v', 'Hits the budget and the quality bar. Nothing to do.']
  if (clean && !quick)
    return [
      'Careful but slow',
      'r',
      'Quality holds up; the time does not — and not just because of the stages they are given, since this compares them with others doing the same ones.',
    ]
  if (!clean && quick)
    return [
      'Quick, but marks come off',
      'r',
      'Faster than their peers and below the quality line — the classic trade, being made without anyone deciding to make it.',
    ]
  return ['Behind on both', 'd', 'Below the quality line and over the budget. This is the one to look at first.']
}

export interface RatedPerson {
  n: string
  c: number
  def: number
  /** Per-axis averages. */
  a: number
  cm: number
  f: number
  /** Overall, across all three axes. */
  o: number
  tw: StageWork | null
}

/** Ratings rolled up per person, keyed on the name stored at rating time. */
export function ratedPeople(rows: QcEntry[], tw: StageWorkResult): RatedPerson[] {
  const by: Record<string, { n: string; c: number; acc: number; comp: number; fmt: number; def: number }> = {}
  rows.forEach((x) => {
    by[x.onName] ??= { n: x.onName, c: 0, acc: 0, comp: 0, fmt: 0, def: 0 }
    const p = by[x.onName]
    p.c++
    p.acc += x.acc
    p.comp += x.comp
    p.fmt += x.fmt
    if (x.defect) p.def++
  })
  return Object.values(by)
    .map((p) => ({
      n: p.n,
      c: p.c,
      def: p.def,
      a: p.acc / p.c,
      cm: p.comp / p.c,
      f: p.fmt / p.c,
      o: (p.acc + p.comp + p.fmt) / (3 * p.c),
      tw: tw.people[p.n] ?? null,
    }))
    .sort((x, y) => y.c - x.c)
}

/** 1 is the worst outcome and 5 the best — the opposite of what most people assume. */
export const QC_SCALE: [score: number, label: string, kind: ChipKind][] = [
  [1, 'Critical', 'd'],
  [2, 'Non critical', 'r'],
  [3, 'MIS', 'r'],
  [4, 'Average', 'b'],
  [5, 'Good', 'v'],
]

/** One number could not say *what* was wrong. Three can. */
export const QC_CRITERIA: [name: string, question: string][] = [
  ['Accuracy', 'Do the typed values match the instrument?'],
  ['Completeness', 'Is every required section present?'],
  ['Formatting', 'Dates, names, money and recording references to the client format'],
]

export interface QcRule {
  k: string
  n: string
  on: boolean
  d: string
  /** What turning it off actually costs — stated, so a checkbox is not scenery. */
  cost: string
}

export const QC_RULES: QcRule[] = [
  {
    k: 'mand',
    n: 'A rating is required before an order can be marked Sent',
    on: true,
    d: 'Closes the gap where a third of delivered work was never rated.',
    cost: 'Without it, a third of deliveries go out unchecked and every average on the Quality report is drawn from the rest.',
  },
  {
    k: 'self',
    n: 'A person cannot QC a stage they performed',
    on: true,
    d: 'Ashok S is in both Typing and Typing QC, so he is filtered out of QC on orders he typed.',
    cost: 'Without it, people can sign off their own work and the QC score stops meaning anything.',
  },
  {
    k: 'note',
    n: 'A score of 1 or 2 requires a comment',
    on: true,
    d: 'A defect with no explanation teaches nobody anything.',
    cost: 'Without it, defects become numbers with no reason attached — the thing the Quality report leads with disappears.',
  },
  {
    k: 'see',
    n: 'Scores are visible to the person rated',
    on: true,
    d: 'On. Each person sees their own ratings and the practice that prevents each defect. Turn off only if ratings are kept for filing rather than coaching.',
    cost: 'With it off, people are measured against something they cannot see, which is the fastest way to make a quality score resented rather than useful.',
  },
  {
    k: 'field',
    n: 'Defects also attach to the field and page',
    on: true,
    d: 'This is what makes the data useful for fixing the process rather than ranking people.',
    cost: 'Without it, you can see who made a mistake but not where it keeps happening.',
  },
]

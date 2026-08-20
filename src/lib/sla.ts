/**
 * Turnaround: the promise to the client, and the internal checkpoints that keep
 * an order on course for it.
 *
 * The buffer is held back before the stages divide the rest, so hitting every
 * checkpoint still leaves slack. A stage in progress is only owed the part of its
 * slice it has not already used — counting the whole slice would flag an order
 * three hours into a perfectly healthy Search.
 */
import { ASSIGN_STAGES } from '@/data/org'
import { BUDGET } from '@/data/budget'
import { hrs } from '@/lib/format'
import { now } from '@/lib/clock'
import type { Order, Tier } from '@/data/types'

export interface SlaRule {
  cl: string
  pr: string
  h: number
}

/** Client + product overrides, falling through to the default rule. */
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

/** No client named on it — the row that applies when nothing more specific does. */
export const isDefaultRule = (r: SlaRule) => r.cl.startsWith('—')

/**
 * The rule that applies, not just the hours it yields.
 *
 * One lookup, deliberately. The design had two — the register asked one question
 * and the new-order form asked another, and they answered differently for the
 * three 48-hour products, so an order quoted at intake changed its due date the
 * moment it was created. Whichever number is right, it has to be the same number
 * on both screens, so both now come through here.
 */
export function slaRuleFor(client: string, product: string): SlaRule {
  return (
    SLA.find((x) => x.cl === client && x.pr === product) ??
    SLA.find((x) => x.cl === client && x.pr === 'Any') ??
    SLA.find((x) => x.pr === product && isDefaultRule(x)) ??
    SLA.find(isDefaultRule) ?? { cl: '—  (default)', pr: 'Any', h: 24 }
  )
}

export const slaHours = (o: Pick<Order, 'cl' | 'pr'>): number => slaRuleFor(o.cl, o.pr).h

/* ── turnaround tiers ───────────────────────────────────────────────────── */

/**
 * What the client is paying for when they ask for it sooner.
 *
 * Priority halves the SLA and rush quarters it, each with an uplift on the fee,
 * so the promise and the price move together — a shorter deadline that cost the
 * same would just be a worse version of the standard one.
 */
export const TIERS: Tier[] = [
  { id: 'standard', n: 'Standard', mult: 1, up: 0 },
  { id: 'priority', n: 'Priority', mult: 0.5, up: 4 },
  { id: 'rush', n: 'Rush', mult: 0.25, up: 9 },
]

export const tierOf = (id: string): Tier => TIERS.find((t) => t.id === id) ?? TIERS[0]

export interface Due {
  /** Hours from now, after the tier is applied. */
  h: number
  at: Date
  /** The SLA before the tier moved it. */
  base: number
}

/** The due date a client, product and tier would produce, from now. */
export function dueFor(client: string, product: string, tier: string): Due {
  const base = slaRuleFor(client, product).h
  const h = Math.max(1, Math.round(base * tierOf(tier).mult))
  return { h, at: hrs(h), base }
}

/* ── stage budgets ──────────────────────────────────────────────────────── */

export const sharesFor = (pr: string): Record<string, number> =>
  BUDGET.over.find((x) => x.pr === pr)?.shares ?? BUDGET.base

export const shareTotal = (sh: Record<string, number>) =>
  ASSIGN_STAGES.reduce((a, st) => a + (sh[st] ?? 0), 0)

export const budgetOK = (sh: Record<string, number>) => Math.round(shareTotal(sh)) === 100

export interface Checkpoint {
  stage: string
  pct: number
  hours: number
  /** Hours from arrival by which this stage should be finished. */
  by: number
}

const cpCache = new Map<string, Checkpoint[]>()

export function checkpoints(slaH: number, pr: string): Checkpoint[] {
  const sh = sharesFor(pr)
  const key = `${slaH}|${pr}|${BUDGET.buffer}|${JSON.stringify(sh)}`
  const hit = cpCache.get(key)
  if (hit) return hit
  const win = slaH * (1 - BUDGET.buffer / 100)
  let cum = 0
  const out = ASSIGN_STAGES.map((st) => {
    const h = (win * (sh[st] ?? 0)) / 100
    cum += h
    return { stage: st, pct: sh[st] ?? 0, hours: h, by: cum }
  })
  cpCache.set(key, out)
  return out
}

const ownersOf = (o: Order) => o.a ?? {}

/** How far an order has actually got: the last stage with a person on it. */
export function curIdx(o: Order): number {
  if (o.done) return ASSIGN_STAGES.length
  const own = ownersOf(o)
  let last = -1
  ASSIGN_STAGES.forEach((st, i) => {
    if (own[st]) last = i
  })
  return last
}

export const curStageOf = (o: Order): string | null => {
  const i = curIdx(o)
  return i < 0 ? ASSIGN_STAGES[0] : i >= ASSIGN_STAGES.length ? null : ASSIGN_STAGES[i]
}

const r2 = (n: number) => Math.round(n * 100) / 100

export interface PlanRow extends Checkpoint {
  at: Date
  done: boolean
  current: boolean
  behind: boolean
}

export interface OrderPlan {
  slaH: number
  rows: PlanRow[]
  elapsed: number
  /** Hours the rest of the pipeline still needs at its budgeted pace. */
  needs: number
  /** Hours until the client deadline. */
  remaining: number
  behind: boolean
  /** Not enough clock left to do the remaining work at its own budgeted pace. */
  doomed: boolean
  short: number
}

export function orderPlan(o: Order): OrderPlan {
  const h = slaHours(o)
  const cps = checkpoints(h, o.pr)
  const i = curIdx(o)
  const elapsed = (now().getTime() - o.recv.getTime()) / 36e5

  const rows: PlanRow[] = cps.map((c, idx) => ({
    ...c,
    at: new Date(o.recv.getTime() + c.by * 36e5),
    done: idx < i,
    current: idx === i,
    behind: idx >= i && elapsed > c.by,
  }))

  const at = Math.max(0, i)
  const left =
    at >= cps.length
      ? 0
      : Math.max(0, cps[at].by - elapsed) + cps.slice(at + 1).reduce((a, c) => a + c.hours, 0)
  const remaining = h - elapsed

  return {
    slaH: h,
    rows,
    elapsed,
    needs: left,
    remaining,
    behind: rows.some((r) => r.behind),
    doomed: !o.done && left > remaining,
    short: r2(left - remaining),
  }
}

export const orderAtRisk = (o: Order) => !o.done && orderPlan(o).doomed

/** Hours, shown the way the design shows them: 2.5h, or 40m under an hour. */
export const hh = (h: number) => (h >= 1 ? `${Math.round(h * 10) / 10}h` : `${Math.round(h * 60)}m`)

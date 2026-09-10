import { ASSIGN_STAGES } from '@/data/org'
import { currentBudget, currentSla } from '@/state/company'
import { SLA, type SlaRule } from '@/data/budget'

export { SLA }
export type { SlaRule }
import { hrs, r2 } from '@/lib/format'
import { now } from '@/lib/clock'
import type { Assignments, Order, Tier } from '@/data/types'

export const isDefaultRule = (r: SlaRule) => r.cl.startsWith('—')

export function slaRuleFor(client: string, product: string): SlaRule {
  const SLA = currentSla()
  return (
    SLA.find((x) => x.cl === client && x.pr === product) ??
    SLA.find((x) => x.cl === client && x.pr === 'Any') ??
    SLA.find((x) => x.pr === product && isDefaultRule(x)) ??
    SLA.find(isDefaultRule) ?? { cl: '—  (default)', pr: 'Any', h: 24 }
  )
}

export const slaHours = (o: Pick<Order, 'cl' | 'pr'>): number => slaRuleFor(o.cl, o.pr).h

const STANDARD: Tier = { id: 'standard', n: 'Standard', mult: 1, up: 0 }

export const TIERS: Tier[] = [
  STANDARD,
  { id: 'priority', n: 'Priority', mult: 0.5, up: 4 },
  { id: 'rush', n: 'Rush', mult: 0.25, up: 9 },
]

export const tierOf = (id: string): Tier => TIERS.find((t) => t.id === id) ?? STANDARD

export interface Due {
  h: number
  at: Date
  base: number
}

export function dueFor(client: string, product: string, tier: string): Due {
  const base = slaRuleFor(client, product).h
  const h = Math.max(1, Math.round(base * tierOf(tier).mult))
  return { h, at: hrs(h), base }
}

export const sharesFor = (pr: string): Record<string, number> => {
  const b = currentBudget()
  return b.over.find((x) => x.pr === pr)?.shares ?? b.base
}

export const shareTotal = (sh: Record<string, number>) =>
  ASSIGN_STAGES.reduce((a, st) => a + (sh[st] ?? 0), 0)

export const budgetOK = (sh: Record<string, number>) => Math.round(shareTotal(sh)) === 100

export interface Checkpoint {
  stage: string
  pct: number
  hours: number
  by: number
}

const cpCache = new Map<string, Checkpoint[]>()

export function checkpoints(slaH: number, pr: string): Checkpoint[] {
  const sh = sharesFor(pr)
  const buffer = currentBudget().buffer
  const key = `${slaH}|${pr}|${buffer}|${JSON.stringify(sh)}`
  const hit = cpCache.get(key)
  if (hit) return hit
  const win = slaH * (1 - buffer / 100)
  let cum = 0
  const out = ASSIGN_STAGES.map((st) => {
    const h = (win * (sh[st] ?? 0)) / 100
    cum += h
    return { stage: st, pct: sh[st] ?? 0, hours: h, by: cum }
  })
  cpCache.set(key, out)
  return out
}

export type Plannable = Pick<Order, 'cl' | 'pr' | 'recv'> & {
  done?: boolean
  a?: Assignments
}

const ownersOf = (o: Plannable) => o.a ?? {}

export function curIdx(o: Plannable): number {
  if (o.done) return ASSIGN_STAGES.length
  const own = ownersOf(o)
  let last = -1
  ASSIGN_STAGES.forEach((st, i) => {
    if (own[st]) last = i
  })
  return last
}

export const curStageOf = (o: Plannable): string | null => {
  const i = curIdx(o)
  return i < 0 ? (ASSIGN_STAGES[0] ?? null) : i >= ASSIGN_STAGES.length ? null : (ASSIGN_STAGES[i] ?? null)
}


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
  needs: number
  remaining: number
  behind: boolean
  doomed: boolean
  short: number
}

export function orderPlan(o: Plannable): OrderPlan {
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
  const cur = cps[at]
  const left = cur ? Math.max(0, cur.by - elapsed) + cps.slice(at + 1).reduce((a, c) => a + c.hours, 0) : 0
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

export const orderAtRisk = (o: Plannable) => !o.done && orderPlan(o).doomed

export const dueOf = (o: Plannable & { due?: Date }): Date =>
  o.due ?? new Date(o.recv.getTime() + slaHours(o) * 36e5)

export const hh = (h: number) => (h >= 1 ? `${Math.round(h * 10) / 10}h` : `${Math.round(h * 60)}m`)

import { ONTIMETARGET } from '@/data/budget'
import type { Delivery } from '@/data/deliveries'
import { now } from '@/lib/clock'

export { ONTIMETARGET }
export type { Delivery }

export interface OnTime {
  pct: number | null
  total: number
  late: number
  rows: Delivery[]
}

export function onTime30(deliveries: Delivery[]): OnTime {
  const cut = now().getTime() - 30 * 86400000
  const rows = deliveries.filter((d) => d.d.getTime() >= cut)
  if (!rows.length) return { pct: null, total: 0, late: 0, rows: [] }
  const late = rows.filter((d) => d.late)
  return {
    pct: ((rows.length - late.length) / rows.length) * 100,
    total: rows.length,
    late: late.length,
    rows: late,
  }
}

export function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  const hi = s[mid] ?? 0
  return s.length % 2 ? hi : ((s[mid - 1] ?? 0) + hi) / 2
}

export const CAPACITY_AMBER = 75
export const CAPACITY_RED = 90

export interface CapacityTone {
  fill: string
  text: 'gr' | 'warn' | 'bad'
}

export function capacityTone(pct: number): CapacityTone {
  if (pct > CAPACITY_RED) return { fill: 'var(--bad)', text: 'bad' }
  if (pct > CAPACITY_AMBER) return { fill: 'var(--warn)', text: 'warn' }
  return { fill: 'var(--ok)', text: 'gr' }
}

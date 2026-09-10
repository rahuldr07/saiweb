/**
 * Cross-cutting numbers the dashboard and reports both quote. Kept in one place
 * so "on time" means exactly one thing everywhere it appears.
 *
 * These take the deliveries rather than importing them. That is what lets the
 * 374 KB of history be fetched on demand: a module that imports it is a module
 * that drags it into whatever chunk it lands in, however little of it is used.
 */
import { ONTIMETARGET } from '@/data/budget'
import type { Delivery } from '@/data/deliveries'
import { now } from '@/lib/clock'

export { ONTIMETARGET }
export type { Delivery }

export interface OnTime {
  /** Null when nothing was delivered in the window — not zero, which would read as "all late". */
  pct: number | null
  total: number
  late: number
  rows: Delivery[]
}

/** On-time delivery over the last thirty days. */
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

/**
 * The middle value, averaging the two middles on an even count.
 *
 * Used rather than the mean throughout the reports: a handful of orders that
 * stalled on a doc request drags a mean somewhere no actual order sits, and the
 * gap between the two is itself the finding — which is why the turnaround tab
 * shows both.
 */
export function median(xs: number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  /* Both indices are inside a list already known to be non-empty, and nought is
     the answer this function gives for nothing to take a middle of anyway. */
  const hi = s[mid] ?? 0
  return s.length % 2 ? hi : ((s[mid - 1] ?? 0) + hi) / 2
}

/**
 * Where a capacity bar changes colour, and why those two numbers.
 *
 * Capacity is not a number, it is a curve, and the hour it crosses 90% is the
 * hour the next arrival starts becoming an exception; 75% is the point that
 * becomes worth watching for. Both screens that draw a load bar read them here,
 * so the same department cannot be amber on one and green on the other.
 */
export const CAPACITY_AMBER = 75
export const CAPACITY_RED = 90

export interface CapacityTone {
  /** Bar fill. */
  fill: string
  /** The figure beside the bar, which the design leaves grey until it matters. */
  text: 'gr' | 'warn' | 'bad'
}

/**
 * The colour a load of `pct` percent of its target carries.
 *
 * The comparison is strict, so a department sitting exactly on the threshold
 * keeps the calmer colour and only the percent past it changes.
 */
export function capacityTone(pct: number): CapacityTone {
  if (pct > CAPACITY_RED) return { fill: 'var(--bad)', text: 'bad' }
  if (pct > CAPACITY_AMBER) return { fill: 'var(--warn)', text: 'warn' }
  return { fill: 'var(--ok)', text: 'gr' }
}

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
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2
}

/** Median end-to-end turnaround, in hours. */
export function medianTurnaround(deliveries: Delivery[]): number {
  return median(deliveries.map((d) => d.hrs))
}

export interface Grouped {
  key: string
  n: number
  late: number
  hrs: number
}

/** Deliveries rolled up by client, product or whatever else the caller picks. */
export function groupDeliveries(
  deliveries: Delivery[],
  pick: (d: Delivery) => string,
): Grouped[] {
  const m = new Map<string, Grouped>()
  for (const d of deliveries) {
    const key = pick(d)
    const g = m.get(key) ?? { key, n: 0, late: 0, hrs: 0 }
    g.n++
    if (d.late) g.late++
    g.hrs += d.hrs
    m.set(key, g)
  }
  return [...m.values()].sort((a, b) => b.n - a.n)
}

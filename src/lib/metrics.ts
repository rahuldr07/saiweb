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

/** Median end-to-end turnaround, in hours. */
export function medianTurnaround(deliveries: Delivery[]): number {
  if (!deliveries.length) return 0
  const xs = deliveries.map((d) => d.hrs).sort((a, b) => a - b)
  return xs[Math.floor(xs.length / 2)]
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

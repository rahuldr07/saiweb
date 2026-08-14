/**
 * Cross-cutting numbers the dashboard and reports both quote. Kept in one place
 * so "on time" means exactly one thing everywhere it appears.
 */
import { DELIVERIES, type Delivery } from '@/data/quality'
import { ONTIMETARGET } from '@/data/budget'
import { now } from '@/lib/clock'

export { ONTIMETARGET }

export interface OnTime {
  pct: number | null
  total: number
  late: number
  rows: Delivery[]
}

/** On-time delivery over the last thirty days. */
export function onTime30(): OnTime {
  const cut = now().getTime() - 30 * 86400000
  const rows = DELIVERIES.filter((d) => d.d.getTime() >= cut)
  if (!rows.length) return { pct: null, total: 0, late: 0, rows: [] }
  const late = rows.filter((d) => d.late)
  return {
    pct: ((rows.length - late.length) / rows.length) * 100,
    total: rows.length,
    late: late.length,
    rows: late,
  }
}

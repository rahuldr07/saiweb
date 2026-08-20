import { now } from './clock'
import { QC_DAYS } from '@/data/quality'

/**
 * Date ranges for the report tabs.
 *
 * One engine keyed by a prefix, so each tab scopes independently — you often
 * want quality over 90 days and turnaround over 7, and a single shared range
 * would make one of those answer the wrong question.
 */

export const QC_PRESETS: [key: string, label: string, days: number | null][] = [
  ['7', 'Last 7 days', 7],
  ['30', 'Last 30 days', 30],
  ['90', 'Last 90 days', 90],
  ['mtd', 'This month', null],
]

export interface Range {
  from: Date
  to: Date
  label: string
  preset: string
}

export interface RangeState {
  preset: string
  from?: string
  to?: string
}

export const DEFAULT_RANGE: RangeState = { preset: '30' }

/** `<input type="date">` wants YYYY-MM-DD whatever the app displays. */
export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const parseIso = (v: string): Date => {
  const [y, m, d] = v.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function resolveRange(state: RangeState): Range {
  const t = now()
  if (state.preset === 'custom' && state.from && state.to) {
    return { from: parseIso(state.from), to: parseIso(state.to), label: 'custom range', preset: 'custom' }
  }
  if (state.preset === 'mtd') {
    return { from: new Date(t.getFullYear(), t.getMonth(), 1), to: t, label: 'this month', preset: 'mtd' }
  }
  const days = (QC_PRESETS.find((x) => x[0] === state.preset) ?? QC_PRESETS[1])[2] ?? 30
  return {
    from: new Date(t.getFullYear(), t.getMonth(), t.getDate() - (days - 1)),
    to: t,
    label: `last ${days} days`,
    preset: state.preset,
  }
}

/** Whole days at both ends, so a range never clips the day it names. */
export const inRange = (d: Date, r: Range) =>
  d >= new Date(r.from.getFullYear(), r.from.getMonth(), r.from.getDate()) &&
  d <= new Date(r.to.getFullYear(), r.to.getMonth(), r.to.getDate(), 23, 59, 59)

/** The furthest back any range may reach — the log does not go beyond it. */
export const rangeFloor = () => {
  const t = now()
  return new Date(t.getFullYear(), t.getMonth(), t.getDate() - (QC_DAYS - 1))
}

/** Moving one end past the other drags the other with it rather than refusing. */
export function setRangeEnd(state: RangeState, which: 'from' | 'to', v: string): RangeState {
  if (!v) return state
  const next: RangeState = { ...state, [which]: v, preset: 'custom' }
  if (next.from && next.to && next.from > next.to) {
    if (which === 'from') next.to = v
    else next.from = v
  }
  return next
}

export function setPreset(state: RangeState, preset: string): RangeState {
  if (preset !== 'custom') return { ...state, preset }
  /* Switching to custom keeps whatever the preset was showing, so the dates do
     not jump the moment you take manual control of them. */
  const r = resolveRange(state)
  return { preset: 'custom', from: state.from ?? iso(r.from), to: state.to ?? iso(r.to) }
}

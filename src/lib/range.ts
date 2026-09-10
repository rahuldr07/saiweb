import { now } from './clock'
import { QC_DAYS } from '@/data/quality'
import { fmtDate, iso, parseIso } from '@/lib/format'

export const QC_PRESETS: [key: string, label: string, days: number | null][] = [
  ['7', 'Last 7 days', 7],
  ['30', 'Last 30 days', 30],
  ['90', 'Last 90 days', 90],
  ['mtd', 'This month', null],
]

export interface Span {
  from: Date
  to: Date
}

export interface Range extends Span {
  label: string
  preset: string
}

export interface RangeState {
  preset: string
  from?: string
  to?: string
}

export const DEFAULT_RANGE: RangeState = { preset: '30' }

export function resolveRange(state: RangeState): Range {
  const t = now()
  if (state.preset === 'custom' && state.from && state.to) {
    return { from: parseIso(state.from), to: parseIso(state.to), label: 'custom range', preset: 'custom' }
  }
  if (state.preset === 'mtd') {
    return { from: new Date(t.getFullYear(), t.getMonth(), 1), to: t, label: 'this month', preset: 'mtd' }
  }
  const preset = QC_PRESETS.find((x) => x[0] === state.preset) ?? QC_PRESETS[1]
  const days = preset?.[2] ?? 30
  return {
    from: new Date(t.getFullYear(), t.getMonth(), t.getDate() - (days - 1)),
    to: t,
    label: `last ${days} days`,
    preset: state.preset,
  }
}

export const inRange = (d: Date, r: Span) =>
  d >= new Date(r.from.getFullYear(), r.from.getMonth(), r.from.getDate()) &&
  d <= new Date(r.to.getFullYear(), r.to.getMonth(), r.to.getDate(), 23, 59, 59)

export const rangeFloor = () => {
  const t = now()
  return new Date(t.getFullYear(), t.getMonth(), t.getDate() - (QC_DAYS - 1))
}

export function setRangeEnd(state: RangeState, which: 'from' | 'to', v: string): RangeState {
  if (!v) return state
  const next: RangeState = { ...state, [which]: v, preset: 'custom' }
  if (next.from && next.to && next.from > next.to) {
    if (which === 'from') next.to = v
    else next.from = v
  }
  return next
}

const MAX_WEEKS = 15

export function weeklyBuckets(r: Range): Span[] {
  const out: Span[] = []
  for (
    let end = new Date(r.to);
    end >= r.from;
    end = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 7)
  ) {
    const start = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 6)
    out.unshift({ from: start < r.from ? r.from : start, to: end })
    if (out.length >= MAX_WEEKS) break
  }
  return out
}

export const weekTick = (d: Date) => fmtDate(d).split('/').slice(0, 2).join('/')

export function setPreset(state: RangeState, preset: string): RangeState {
  if (preset !== 'custom') return { ...state, preset }
  const r = resolveRange(state)
  return { preset: 'custom', from: state.from ?? iso(r.from), to: state.to ?? iso(r.to) }
}

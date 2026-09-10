import { now } from './clock'
import type { ChipKind } from '@/data/types'

export const TZ = 'ET'
export const TZ2 = 'IST'

export const LOCAL_OFFSET_H = 9.5

export const pad = (n: number | string) => String(n).padStart(2, '0')

export const r2 = (n: number) => Math.round(n * 100) / 100

export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY'
let dateFormat: DateFormat = 'MM/DD/YYYY'

export const getDateFormat = () => dateFormat
export const setDateFormat = (f: DateFormat) => {
  dateFormat = f
}

export const fmtDate = (d: Date) =>
  dateFormat === 'DD/MM/YYYY'
    ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
    : `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`

export const parseUsDate = (v: string): Date => {
  const [m, d, y] = v.split('/').map(Number)
  if (m === undefined || d === undefined || y === undefined) return new Date(NaN)
  return new Date(y, m - 1, d)
}

export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export const parseIso = (v: string): Date => {
  const [y, m, d] = v.split('-').map(Number)
  if (y === undefined || m === undefined || d === undefined) return new Date(NaN)
  return new Date(y, m - 1, d)
}

export const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export const fmtTime = (d: Date) => {
  let h = d.getHours()
  const m = pad(d.getMinutes())
  const ap = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${m} ${ap}`
}

export const fmtDT = (d: Date) => `${fmtDate(d)} ${fmtTime(d)}`

export const hrs = (h: number) => new Date(now().getTime() + h * 3600000)

export const dstamp = () => `${now().getFullYear()}-${pad(now().getMonth() + 1)}-${pad(now().getDate())}`

export const money = (n: number) =>
  '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const initials = (n: string) =>
  n
    .split(/[\s.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0])
    .join('')
    .toUpperCase()

export type DueKind = 'late' | 'soon' | 'ok'

export const SOON_HOURS = 4

export function dueMeta(d: Date): { kind: DueKind; abs: string; rel: string } {
  const diff = (d.getTime() - now().getTime()) / 3600000
  const kind: DueKind = diff < 0 ? 'late' : diff < SOON_HOURS ? 'soon' : 'ok'
  const rel =
    diff < 0
      ? `${Math.abs(Math.round(diff))}h overdue`
      : diff < 24
        ? `in ${Math.round(diff)}h`
        : `in ${Math.round(diff / 24)}d`
  return { kind, abs: `${fmtDate(d)} ${fmtTime(d)}`, rel }
}

export interface Dueable {
  due: Date
  done?: boolean
}

export type OrderState = 'done' | 'late' | 'soon' | 'open'

export function orderState(o: Dueable): OrderState {
  if (o.done) return 'done'
  const { kind } = dueMeta(o.due)
  return kind === 'ok' ? 'open' : kind
}

const ORDER_CHIP: Record<OrderState, ChipKind> = { done: 'v', late: 'd', soon: 'b', open: 'b' }

export const orderChipKind = (o: Dueable): ChipKind => ORDER_CHIP[orderState(o)]

export const daysSince = (d: Date) => Math.floor((now().getTime() - d.getTime()) / 86400000)

export const pct = (n: number, digits = 0) => `${n.toFixed(digits)}%`

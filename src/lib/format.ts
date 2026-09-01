/**
 * Formatting rules, taken from the design.
 *
 * Two are load-bearing and must not drift:
 *  - One date format company-wide (MM/DD/YYYY). Effective dates are legally
 *    material, so this is a single setting rather than a per-screen choice.
 *  - Mono, tabular numerals for every id, date, money figure, count and
 *    percentage. That is a CSS concern (`.mono`), but it is why these helpers
 *    return bare strings rather than markup.
 */
import { now } from './clock'

/** Deadlines are stated in the client's zone; the operator's is secondary. */
export const TZ = 'ET'
export const TZ2 = 'IST'

/** The operator's zone runs 9h30m ahead of the client's. */
export const LOCAL_OFFSET_H = 9.5

export const pad = (n: number | string) => String(n).padStart(2, '0')

/**
 * Two decimal places, as a number rather than a string.
 *
 * Money and part-days both need it: summing invoice lines in floats drifts by a
 * penny, and half a day of leave prints as 0.5 rather than 0.49999999999999994.
 * Eight modules had written this line out for themselves.
 */
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

/**
 * The inverse of `fmtDate` for the stored MM/DD/YYYY strings — joining dates,
 * birthdays, holidays. Deliberately not `new Date(str)`, which reads the same
 * string as UTC in some engines and local in others, moving a date by a day
 * depending on the timezone the browser happens to be in.
 */
export const parseUsDate = (v: string): Date => {
  const [m, d, y] = v.split('/').map(Number)
  return new Date(y, m - 1, d)
}

/** `<input type="date">` wants YYYY-MM-DD whatever the app displays. */
export const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** The inverse, and local for the same reason `parseUsDate` is. */
export const parseIso = (v: string): Date => {
  const [y, m, d] = v.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * The start of a date's day.
 *
 * Notice, ageing and "days until" are all counted between midnights rather than
 * between timestamps — comparing a date against an instant made a request
 * starting today read as minus one day's notice.
 */
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

/** Client-side money is USD. */
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

/** Late is computed from the due datetime — nobody marks it. */
export function dueMeta(d: Date): { kind: DueKind; abs: string; rel: string } {
  const diff = (d.getTime() - now().getTime()) / 3600000
  const kind: DueKind = diff < 0 ? 'late' : diff < 4 ? 'soon' : 'ok'
  const rel =
    diff < 0
      ? `${Math.abs(Math.round(diff))}h overdue`
      : diff < 24
        ? `in ${Math.round(diff)}h`
        : `in ${Math.round(diff / 24)}d`
  return { kind, abs: `${fmtDate(d)} ${fmtTime(d)}`, rel }
}

/** Days between a past date and the fixed clock. */
export const daysSince = (d: Date) => Math.floor((now().getTime() - d.getTime()) / 86400000)

export const pct = (n: number, digits = 0) => `${n.toFixed(digits)}%`

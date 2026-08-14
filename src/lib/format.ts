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

/** Deadlines are stated in the client's zone; the operator's is secondary. */
export const TZ = 'ET'
export const TZ2 = 'IST'

export const pad = (n: number | string) => String(n).padStart(2, '0')

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

export const fmtTime = (d: Date) => {
  let h = d.getHours()
  const m = pad(d.getMinutes())
  const ap = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${m} ${ap}`
}

export const fmtDT = (d: Date) => `${fmtDate(d)} ${fmtTime(d)}`

/**
 * Mon 3 Aug 2026, 5:30 PM ET — a fixed clock at the end of the working day.
 * The design pins "now" so every countdown, late flag and roll-up is stable.
 */
export const NOW = new Date(2026, 7, 3, 17, 30)

export const hrs = (h: number) => new Date(NOW.getTime() + h * 3600000)

export const dstamp = () => `${NOW.getFullYear()}-${pad(NOW.getMonth() + 1)}-${pad(NOW.getDate())}`

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
  const diff = (d.getTime() - NOW.getTime()) / 3600000
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
export const daysSince = (d: Date) => Math.floor((NOW.getTime() - d.getTime()) / 86400000)

export const pct = (n: number, digits = 0) => `${n.toFixed(digits)}%`

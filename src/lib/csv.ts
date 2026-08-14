/**
 * Everything exports. Any register — orders, invoices, people, payroll,
 * attendance — builds its CSV from the same filtered rows the screen is showing;
 * exporting something different from what you are looking at is worse than not
 * exporting at all.
 */
import { dstamp } from './format'

export type CsvRow = (string | number | null | undefined)[]

/** U+FEFF, written as an escape so the source file carries no invisible characters. */
const BOM = '\u{FEFF}'

export function toCSV(rows: CsvRow[]): string {
  const q = (v: string | number | null | undefined) => {
    const t = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
  }
  return rows.map((r) => r.map(q).join(',')).join('\r\n')
}

/** `‹thing›-YYYY-MM-DD.csv`, the naming the design uses everywhere. */
export const csvName = (thing: string) => `${thing}-${dstamp()}.csv`

export interface CsvResult {
  name: string
  rows: CsvRow[]
  csv: string
}

/**
 * Builds the file and hands it to the browser. The BOM keeps Excel from
 * mangling the ₹ and · characters that appear throughout this data.
 */
export function downloadCSV(name: string, rows: CsvRow[]): CsvResult {
  const csv = toCSV(rows)
  try {
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = name
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      URL.revokeObjectURL(a.href)
      a.remove()
    }, 0)
  } catch {
    /* no download in this environment — the data is still built */
  }
  return { name, rows, csv }
}

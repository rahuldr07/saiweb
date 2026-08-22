import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { ReportCsv } from '@/lib/report-csv'

/**
 * How the Export button knows what the tab is showing.
 *
 * The button lives in the page header and the filters live inside each tab, so
 * something has to cross between them. Lifting six tabs' filter state into the
 * shell would put day pickers, date ranges and pill selections in a component
 * that renders none of them; passing the data down would mean the shell
 * computing every tab's figures a second time.
 *
 * So the tab — which already holds exactly the rows it is drawing — registers a
 * builder, and the shell calls it. Whatever is on screen is what comes out,
 * which is the one property an export has to have.
 *
 * The registration deliberately fires on mount and unmount only. The builder
 * closes over state that changes on every keystroke, so notifying the shell
 * each time it changed would re-render the shell, re-render the tab, and
 * register again — which is an infinite loop, not a subscription. A ref holds
 * the current closure instead, and the shell reads through it.
 */

let builder: (() => ReportCsv) | null = null
const listeners = new Set<() => void>()

const emit = () => {
  for (const l of listeners) l()
}
const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
const snapshot = () => builder

/** Called by the active tab. Registers once; the ref keeps it current. */
export function useReportExport(make: () => ReportCsv): void {
  const latest = useRef(make)

  /* Every render, without notifying anybody — this is what keeps the export in
     step with the filters. */
  useEffect(() => {
    latest.current = make
  })

  useEffect(() => {
    const stable = () => latest.current()
    builder = stable
    emit()
    return () => {
      if (builder === stable) {
        builder = null
        emit()
      }
    }
  }, [])
}

/** Read by the shell. Null while no tab has registered — the button disables. */
export const useReportExporter = (): (() => ReportCsv) | null =>
  useSyncExternalStore(subscribe, snapshot, snapshot)

import { useEffect, useRef } from 'react'
import { createStore, useStore } from '@/lib/store'
import type { ReportCsv } from '@/lib/report-csv'

const store = createStore<(() => ReportCsv) | null>(null)

export function useReportExport(make: () => ReportCsv): void {
  const latest = useRef(make)

  useEffect(() => {
    latest.current = make
  })

  useEffect(() => {
    const stable = () => latest.current()
    store.set(stable)
    return () => {
      if (store.get() === stable) store.set(null)
    }
  }, [])
}

export const useReportExporter = (): (() => ReportCsv) | null => useStore(store)

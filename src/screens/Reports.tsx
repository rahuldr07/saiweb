import { useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { Btn, PageHead, Tabs } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { LoadFailed } from '@/components/async'
import { useUi } from '@/state/ui'
import { useDeliveries } from '@/lib/useDeliveries'
import { useQcLog } from '@/lib/useQcLog'
import { csvName, downloadCSV } from '@/lib/csv'
import { Received } from './reports/Received'
import { Assigned } from './reports/Assigned'
import { Turnaround } from './reports/Turnaround'
import { ByStaff } from './reports/ByStaff'
import { ByDepartment } from './reports/ByDepartment'
import { Quality } from './reports/Quality'
import { useReportExporter } from '@/state/reportExport'

const TABS = ['Received', 'Assigned', 'Turnaround', 'By staff', 'By department', 'Quality'] as const
type Tab = (typeof TABS)[number]

function Reports() {
  const { tab: tabParam, sw, dw } = useSearch({ from: '/reports' })
  const isTab = (t?: string): t is Tab => !!t && (TABS as readonly string[]).includes(t)

  const [tab, setTab] = useState<Tab>(isTab(tabParam) ? tabParam : 'Received')
  const [dept, setDept] = useState<string | undefined>(dw === 'all' ? undefined : dw)
  const [person, setPerson] = useState<string | undefined>(sw === 'all' ? undefined : sw)
  const { toast } = useUi()

  const openDept = (d: string) => {
    setDept(d)
    setPerson(undefined)
    setTab('By department')
  }

  const openStaff = (id: string) => {
    setPerson(id)
    setTab('By staff')
  }

  const pickTab = (t: Tab) => {
    if (t !== 'By department') setDept(undefined)
    if (t !== 'By staff') setPerson(undefined)
    setTab(t)
  }

  const needsHistory = tab === 'Turnaround' || tab === 'Quality'
  const history = useDeliveries()
  const qc = useQcLog()

  const exporter = useReportExporter()
  const exportTab = () => {
    if (!exporter) return
    const { name, rows } = exporter()
    const out = downloadCSV(csvName(name), rows)
    toast(`${out.name} — ${out.rows.length - 1} rows`)
  }

  if (needsHistory && (history.isError || qc.isError)) {
    return (
      <>
        <PageHead title="Reports" sub="Everything about the day in one place." />
        <LoadFailed
          what={history.isError ? 'The delivery history' : 'The QC log'}
          error={history.error ?? qc.error}
          onRetry={() => {
            void history.refetch()
            void qc.refetch()
          }}
        />
      </>
    )
  }

  const loading = needsHistory && (history.isPending || qc.isPending)

  return (
    <>
      <PageHead
        title="Reports"
        sub="Everything about the day in one place — what came in, who it went to, how fast, and how good."
        actions={
          <Btn variant="ghost" onClick={exportTab} disabled={loading || !exporter}>
            Export
          </Btn>
        }
      />

      <Tabs tabs={[...TABS]} value={tab} onChange={pickTab} />

      {tab === 'Received' ? <Received /> : null}
      {tab === 'Assigned' ? <Assigned onOpenStaff={() => pickTab('By staff')} /> : null}
      {tab === 'By staff' ? (
        <ByStaff key={person ?? 'all'} initial={person} onOpenDept={openDept} />
      ) : null}
      {tab === 'By department' ? (
        <ByDepartment key={dept ?? 'all'} initial={dept} onOpenStaff={openStaff} />
      ) : null}

      {tab === 'Turnaround' ? (
        loading ? (
          <p className="gr" style={{ fontSize: 'var(--t-body)' }}>
            Loading the delivery history…
          </p>
        ) : (
          <Turnaround deliveries={history.data ?? []} />
        )
      ) : null}

      {tab === 'Quality' ? (
        loading ? (
          <p className="gr" style={{ fontSize: 'var(--t-body)' }}>
            Loading the delivery history and QC log…
          </p>
        ) : (
          <Quality deliveries={history.data ?? []} log={qc.data ?? []} />
        )
      ) : null}
    </>
  )
}

export default function ReportsRoute() {
  return (
    <RequireCap cap="all">
      <Reports />
    </RequireCap>
  )
}

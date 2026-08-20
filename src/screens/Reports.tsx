import { useState } from 'react'
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
import { board } from '@/lib/engine'

/** The design's own tab order — what came in, then where it went, then how it went. */
const TABS = ['Received', 'Assigned', 'Turnaround', 'By staff', 'By department', 'Quality'] as const
type Tab = (typeof TABS)[number]

/**
 * Everything about the day in one place — what came in, who it went to, how fast,
 * and how good.
 *
 * The six tabs answer different questions off different data: Received and
 * Assigned read the assignment engine's run of today, Turnaround and Quality read
 * 90 days of delivery history, and the two workload tabs roll up the run per
 * person and per department. They are one screen because the questions are asked
 * together, not because the data is.
 */
function Reports() {
  const [tab, setTab] = useState<Tab>('Received')
  /* Set when arriving from a By-staff department tile, so the department tab
     opens on that department rather than on the whole floor. */
  const [dept, setDept] = useState<string | undefined>()
  const { toast } = useUi()

  const openDept = (d: string) => {
    setDept(d)
    setTab('By department')
  }

  const pickTab = (t: Tab) => {
    if (t !== 'By department') setDept(undefined)
    setTab(t)
  }

  /* Only the history-backed tabs pay for the fetch. */
  const needsHistory = tab === 'Turnaround' || tab === 'Quality'
  const history = useDeliveries()
  const qc = useQcLog()

  const exportTab = () => {
    const { run, depts, worked } = board()
    const data: (string | number)[][] =
      tab === 'By department'
        ? [
            ['Department', 'Available', 'Capacity', 'Carrying', 'Done today', 'Still open', 'Unplaced'],
            ...depts.map((d) => [d.d, d.avail, d.cap, d.load, d.done, d.pend, d.unplaced]),
          ]
        : tab === 'By staff'
          ? [
              ['Staff', 'Departments', 'Done', 'Pending', 'Total'],
              ...worked.map((w) => [w.s.n, w.s.dep.join(' / '), w.done, w.pend, w.tot]),
            ]
          : tab === 'Assigned'
            ? [
                ['Order', 'Stage', 'Who', 'Client', 'Product', 'Day'],
                ...run.assigns.map((a) => [a.o.id, a.stage, a.who, a.o.cl, a.o.pr, a.dk]),
              ]
            : tab === 'Quality'
              ? [
                  ['Rated', 'Order', 'Stage', 'Who did it', 'Rated by', 'Accuracy', 'Completeness', 'Formatting', 'Average', 'Reason'],
                  ...(qc.data ?? []).map((x) => [
                    x.dk,
                    x.order,
                    x.stage,
                    x.onName,
                    x.byName,
                    x.acc,
                    x.comp,
                    x.fmt,
                    x.avg.toFixed(2),
                    x.note ?? '',
                  ]),
                ]
              : tab === 'Turnaround'
                ? [
                    ['Delivered', 'Order', 'Client', 'Product', 'Promise (h)', 'Took (h)', 'Late'],
                    ...(history.data ?? []).map((x) => [
                      x.dk,
                      x.id,
                      x.cl,
                      x.pr,
                      x.slaH,
                      Math.round(x.hrs * 100) / 100,
                      x.late ? 'yes' : 'no',
                    ]),
                  ]
                : [
                    ['Order', 'Arrived', 'Client', 'Product', 'State', 'County', 'Day'],
                    ...run.orders.map((o) => [o.id, `${o.hr}:00`, o.cl, o.pr, o.st, o.co, o.dk]),
                  ]

    const out = downloadCSV(csvName(`report-${tab.toLowerCase().replace(/\s+/g, '-')}`), data)
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
          <Btn variant="ghost" onClick={exportTab} disabled={loading}>
            Export
          </Btn>
        }
      />

      <Tabs tabs={[...TABS]} value={tab} onChange={pickTab} />

      {tab === 'Received' ? <Received /> : null}
      {tab === 'Assigned' ? <Assigned onOpenStaff={() => pickTab('By staff')} /> : null}
      {tab === 'By staff' ? <ByStaff onOpenDept={openDept} /> : null}
      {tab === 'By department' ? <ByDepartment key={dept ?? 'all'} initial={dept} /> : null}

      {tab === 'Turnaround' ? (
        loading ? (
          <p className="gr" style={{ fontSize: '13.5px' }}>
            Loading the delivery history…
          </p>
        ) : (
          <Turnaround deliveries={history.data ?? []} />
        )
      ) : null}

      {tab === 'Quality' ? (
        loading ? (
          <p className="gr" style={{ fontSize: '13.5px' }}>
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

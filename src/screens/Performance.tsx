import { useMemo, useState } from 'react'
import { Btn, Card, CardHead, Kpi, Kpis, PageHead, SectionHead, Tabs } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { LoadFailed, SkeletonValue } from '@/components/async'
import { useUi } from '@/state/ui'
import { ASSIGN_STAGES } from '@/data/org'
import { board } from '@/lib/engine'
import {
  ONTIMETARGET,
  groupDeliveries,
  medianTurnaround,
  onTime30,
  type Delivery,
} from '@/lib/metrics'
import { useDeliveries } from '@/lib/useDeliveries'
import { hh } from '@/lib/sla'
import { csvName, downloadCSV } from '@/lib/csv'

const TABS = ['Turnaround', 'By client', 'By product'] as const
type Tab = (typeof TABS)[number]

/**
 * How the company is delivering against what it promised: on-time rate, where
 * the hours go stage by stage, and the same question asked of each client and
 * product. The personal equivalent is "How I'm doing", which compares a person
 * to their own target and never to a colleague.
 *
 * Every table here exports.
 */
function Performance() {
  const { toast } = useUi()
  const [tab, setTab] = useState<Tab>('Turnaround')

  const { run: RUN } = board()

  /* 374 KB of history, fetched when this screen opens rather than shipped with
     the route. Every figure below is derived from it, so they arrive together. */
  const history = useDeliveries()
  const deliveries: Delivery[] = useMemo(() => history.data ?? [], [history.data])
  const loading = history.isPending

  const ot = useMemo(() => onTime30(deliveries), [deliveries])
  const byClient = useMemo(() => groupDeliveries(deliveries, (d) => d.cl), [deliveries])
  const byProduct = useMemo(() => groupDeliveries(deliveries, (d) => d.pr), [deliveries])
  const median = useMemo(() => medianTurnaround(deliveries), [deliveries])

  const stageAvg = useMemo(
    () =>
      ASSIGN_STAGES.map((s) => {
        const xs = deliveries.map((d) => d.st[s]).filter((x) => typeof x === 'number')
        return { stage: s, avg: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0 }
      }),
    [deliveries],
  )

  const rows = tab === 'By client' ? byClient : tab === 'By product' ? byProduct : []

  if (history.isError) {
    return (
      <>
        <PageHead title="Performance" sub="How we are delivering against the promise." />
        <LoadFailed what="The delivery history" error={history.error} onRetry={() => history.refetch()} />
      </>
    )
  }

  const exportTab = () => {
    const data =
      tab === 'Turnaround'
        ? [
            ['Stage', 'Average hours'],
            ...stageAvg.map((s) => [s.stage, Math.round(s.avg * 100) / 100]),
          ]
        : [
            [tab === 'By client' ? 'Client' : 'Product', 'Delivered', 'Late', 'On time %', 'Average hours'],
            ...rows.map((g) => [
              g.key,
              g.n,
              g.late,
              (((g.n - g.late) / g.n) * 100).toFixed(1),
              Math.round((g.hrs / g.n) * 100) / 100,
            ]),
          ]
    const out = downloadCSV(csvName(`report-${tab.toLowerCase().replace(/\s+/g, '-')}`), data)
    toast(`${out.name} — ${out.rows.length - 1} rows`)
  }

  return (
    <>
      <PageHead
        title="Performance"
        sub={
          loading
            ? 'How we are delivering against the promise.'
            : `How we are delivering against the promise, across ${deliveries.length} delivered orders.`
        }
        actions={
          <Btn variant="ghost" onClick={exportTab}>
            Export
          </Btn>
        }
      />

      <Kpis>
        <Kpi
          title="On time · 30d"
          value={loading ? <SkeletonValue /> : ot.pct === null ? '—' : ot.pct.toFixed(1) + '%'}
          tone={!loading && ot.pct !== null && ot.pct < ONTIMETARGET ? 'warn' : undefined}
          detail={loading ? `target ${ONTIMETARGET}%` : `target ${ONTIMETARGET}% · ${ot.late} late of ${ot.total}`}
        />
        <Kpi
          title="Median turnaround"
          value={loading ? <SkeletonValue width={56} /> : <span className="mono">{hh(median)}</span>}
          detail="end to end"
        />
        <Kpi
          title="Delivered"
          value={loading ? <SkeletonValue width={48} /> : deliveries.length}
          detail="all time"
        />
        <Kpi title="Placed today" value={RUN.assigns.filter((a) => a.today).length} detail="stages given an owner" />
      </Kpis>

      <div style={{ marginTop: 20 }}>
        <Tabs tabs={[...TABS]} value={tab} onChange={setTab} />
      </div>

      {tab === 'Turnaround' ? (
        <>
          <SectionHead>Average hours per stage</SectionHead>
          <Card padded>
            <div className="tsc">
              <table className="mat">
                <thead>
                  <tr>
                    <th>Stage</th>
                    <th style={{ textAlign: 'right' }}>Average</th>
                    <th style={{ textAlign: 'right' }}>Share of the order</th>
                  </tr>
                </thead>
                <tbody>
                  {stageAvg.map((s) => {
                    const total = stageAvg.reduce((a, x) => a + x.avg, 0)
                    return (
                      <tr key={s.stage}>
                        <td>{s.stage}</td>
                        <td className="n">{hh(s.avg)}</td>
                        <td className="n">{total ? ((s.avg / total) * 100).toFixed(1) : '0.0'}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : null}

      {tab === 'By client' || tab === 'By product' ? (
        <Card padded>
          <CardHead title={tab} />
          <div className="tsc">
            <table className="mat">
              <thead>
                <tr>
                  <th>{tab === 'By client' ? 'Client' : 'Product'}</th>
                  <th style={{ textAlign: 'right' }}>Delivered</th>
                  <th style={{ textAlign: 'right' }}>Late</th>
                  <th style={{ textAlign: 'right' }}>On time</th>
                  <th style={{ textAlign: 'right' }}>Average</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((g) => {
                  const pct = ((g.n - g.late) / g.n) * 100
                  return (
                    <tr key={g.key}>
                      <td>{g.key}</td>
                      <td className="n">{g.n}</td>
                      <td className="n">{g.late}</td>
                      <td className="n" style={{ color: pct < ONTIMETARGET ? 'var(--warn)' : 'var(--ok)' }}>
                        {pct.toFixed(1)}%
                      </td>
                      <td className="n">{hh(g.hrs / g.n)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {/* Departmental workload lives on Assignment → Capacity, where it can be
          acted on. Two screens reporting the same figures only ever drift. */}
    </>
  )
}

export default function PerformanceRoute() {
  return (
    <RequireCap cap="all">
      <Performance />
    </RequireCap>
  )
}

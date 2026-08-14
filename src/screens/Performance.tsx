import { useMemo, useState } from 'react'
import { Btn, Card, CardHead, Kpi, Kpis, PageHead, SectionHead, Tabs } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { useUi } from '@/state/ui'
import { DELIVERIES } from '@/data/quality'
import { ASSIGN_STAGES } from '@/data/org'
import { DEPTS, RUN } from '@/lib/engine'
import { ONTIMETARGET, onTime30 } from '@/lib/metrics'
import { hh } from '@/lib/sla'
import { csvName, downloadCSV } from '@/lib/csv'

const TABS = ['Turnaround', 'By client', 'By product', 'By department'] as const
type Tab = (typeof TABS)[number]

type Group = { key: string; n: number; late: number; hrs: number }

function groupBy(pick: (d: (typeof DELIVERIES)[number]) => string): Group[] {
  const m = new Map<string, Group>()
  DELIVERIES.forEach((d) => {
    const key = pick(d)
    const g = m.get(key) ?? { key, n: 0, late: 0, hrs: 0 }
    g.n++
    if (d.late) g.late++
    g.hrs += d.hrs
    m.set(key, g)
  })
  return [...m.values()].sort((a, b) => b.n - a.n)
}

/**
 * How the company is delivering against what it promised: on-time rate, where
 * the hours go stage by stage, and the same question asked of each client,
 * product and department. The personal equivalent is "How I'm doing", which
 * compares a person to their own target and never to a colleague.
 *
 * Every table here exports.
 */
function Performance() {
  const { toast } = useUi()
  const [tab, setTab] = useState<Tab>('Turnaround')

  const ot = onTime30()
  const byClient = useMemo(() => groupBy((d) => d.cl), [])
  const byProduct = useMemo(() => groupBy((d) => d.pr), [])

  const median = useMemo(() => {
    const xs = DELIVERIES.map((d) => d.hrs).sort((a, b) => a - b)
    return xs.length ? xs[Math.floor(xs.length / 2)] : 0
  }, [])

  const stageAvg = useMemo(
    () =>
      ASSIGN_STAGES.map((s) => {
        const xs = DELIVERIES.map((d) => d.st[s]).filter((x) => typeof x === 'number')
        return { stage: s, avg: xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0 }
      }),
    [],
  )

  const rows = tab === 'By client' ? byClient : tab === 'By product' ? byProduct : []

  const exportTab = () => {
    const data =
      tab === 'By department'
        ? [
            ['Department', 'Available', 'Capacity', 'Carrying', 'Done today', 'Still open', 'Unplaced'],
            ...DEPTS.map((d) => [d.d, d.avail, d.cap, d.load, d.done, d.pend, d.unplaced]),
          ]
        : tab === 'Turnaround'
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
        sub={`How we are delivering against the promise, across ${DELIVERIES.length} delivered orders.`}
        actions={
          <Btn variant="ghost" onClick={exportTab}>
            Export
          </Btn>
        }
      />

      <Kpis>
        <Kpi
          title="On time · 30d"
          value={ot.pct === null ? '—' : ot.pct.toFixed(1) + '%'}
          tone={ot.pct !== null && ot.pct < ONTIMETARGET ? 'warn' : undefined}
          detail={`target ${ONTIMETARGET}% · ${ot.late} late of ${ot.total}`}
        />
        <Kpi title="Median turnaround" value={<span className="mono">{hh(median)}</span>} detail="end to end" />
        <Kpi title="Delivered" value={DELIVERIES.length} detail="all time" />
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

      {tab === 'By department' ? (
        <Card padded>
          <CardHead title="Workload today" />
          <div className="tsc">
            <table className="mat">
              <thead>
                <tr>
                  <th>Department</th>
                  <th style={{ textAlign: 'right' }}>Available</th>
                  <th style={{ textAlign: 'right' }}>Room</th>
                  <th style={{ textAlign: 'right' }}>Carrying</th>
                  <th style={{ textAlign: 'right' }}>Done</th>
                  <th style={{ textAlign: 'right' }}>Open</th>
                  <th style={{ textAlign: 'right' }}>Unplaced</th>
                </tr>
              </thead>
              <tbody>
                {DEPTS.map((d) => (
                  <tr key={d.d}>
                    <td>{d.d}</td>
                    <td className="n">
                      {d.avail}/{d.staff.length}
                    </td>
                    <td className="n">{d.cap}</td>
                    <td className="n">{d.load}</td>
                    <td className="n">{d.done}</td>
                    <td className="n">{d.pend}</td>
                    <td className="n" style={d.unplaced ? { color: 'var(--bad)' } : undefined}>
                      {d.unplaced}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
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

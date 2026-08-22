import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Banner, Btn, Card, Chip, SectionHead } from '@/components/ui'
import { DayPicker } from './DayPicker'
import { assignedCsv } from '@/lib/report-csv'
import { useReportExport } from './useReportExport'
import { board } from '@/lib/engine'
import { ASSIGN_STAGES } from '@/data/org'
import { AVAIL, STAFF } from '@/data/people'
import { PRODUCTS } from '@/data/catalog'
import { fmtDate } from '@/lib/format'
import { now } from '@/lib/clock'

const val = (n: number) => (n ? <b className="mono">{n}</b> : <span className="gr">—</span>)

/** Who got what, by department, broken down by product. */
export function Assigned({ onOpenStaff }: { onOpenStaff: () => void }) {
  const { run } = board()
  const navigate = useNavigate()
  const [day, setDay] = useState(() => fmtDate(now()))
  const [dept, setDept] = useState('all')

  const as = day === 'all' ? run.assigns : run.assigns.filter((a) => a.dk === day)
  useReportExport(() => assignedCsv(as))
  const scope = day === 'all' ? `all ${run.days.length} days` : day
  const products = PRODUCTS.map((p) => p.id).filter((id) => as.some((a) => a.o.pr === id))
  const shown = ASSIGN_STAGES.filter((d) => dept === 'all' || d === dept)
  const peopleIn = (d: string) =>
    STAFF.filter((s) => s.dep.includes(d)).sort((a, b) => a.n.localeCompare(b.n))

  return (
    <>
      <DayPicker value={day} onChange={setDay} />

      <Banner
        kind="b"
        icon="◔"
        title={`${as.length} assignments across ${ASSIGN_STAGES.length} departments — ${scope}`}
        actions={<Btn onClick={onOpenStaff}>Per-person detail</Btn>}
      >
        Every order passes through each department, so one order appears once per row of stages. A person
        listed with no orders was eligible but not needed.
      </Banner>

      <div style={{ margin: '16px 0 4px' }}>
        <select
          className="inp"
          style={{ minWidth: 250 }}
          aria-label="Filter by department"
          value={dept}
          onChange={(e) => setDept(e.target.value)}
        >
          <option value="all">All departments</option>
          {ASSIGN_STAGES.map((d) => (
            <option key={d} value={d}>
              {d} — {as.filter((a) => a.stage === d).length}
            </option>
          ))}
        </select>
      </div>

      {shown.map((d) => {
        const mine = as.filter((a) => a.stage === d)
        const ppl = peopleIn(d)
        return (
          <div key={d}>
            <SectionHead>
              {d} — {mine.length} assigned
            </SectionHead>
            <Card>
              <div className="tsc">
                <table className="mat" style={{ minWidth: 330 + products.length * 68 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 34 }}>#</th>
                      <th>{d}</th>
                      {products.map((p) => (
                        <th
                          key={p}
                          style={{ textAlign: 'right' }}
                          title={PRODUCTS.find((x) => x.id === p)?.n ?? p}
                        >
                          {p}
                        </th>
                      ))}
                      <th style={{ textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ppl.map((s, i) => {
                      const his = mine.filter((a) => a.who === s.id)
                      return (
                        <tr key={s.id} style={his.length ? undefined : { opacity: 0.62 }}>
                          <td className="gr mono" style={{ fontSize: '11.5px' }}>
                            {i + 1}
                          </td>
                          <td>
                            <button
                              type="button"
                              style={{ fontWeight: 650, color: 'var(--brand)' }}
                              onClick={() => navigate({ to: '/staff/$personId', params: { personId: s.id } })}
                            >
                              {s.n}
                            </button>
                            {s.avail !== 'ok' ? (
                              <>
                                {' '}
                                <Chip kind="r">{AVAIL[s.avail][0]}</Chip>
                              </>
                            ) : null}
                          </td>
                          {products.map((p) => (
                            <td className="n" key={p} title={`${s.n} · ${p}`}>
                              {val(his.filter((a) => a.o.pr === p).length)}
                            </td>
                          ))}
                          <td className="tot">{his.length || '—'}</td>
                        </tr>
                      )
                    })}
                    <tr>
                      <td />
                      <td style={{ fontWeight: 700 }}>All of {d}</td>
                      {products.map((p) => (
                        <td className="tot" key={p}>
                          {mine.filter((a) => a.o.pr === p).length || '—'}
                        </td>
                      ))}
                      <td className="tot corner">{mine.length}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )
      })}

      <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
        Counts come from the assignment engine, not from a separate tally, so this and the Assignment screen
        can never disagree.
      </p>
    </>
  )
}

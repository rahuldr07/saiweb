import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Avatar, Btn, Card, Kpi, Kpis, EmbedHead, SectionHead } from '@/components/ui'
import { WorkFilter, WorkRow, WorkTable, WORKCOLS, useWorkFilter } from './WorkRows'
import { workloadCsv } from '@/lib/report-csv'
import { useReportExport } from './useReportExport'
import { Cell, FlexRow, FlexTable } from '@/components/FlexTable'
import { FocusKpis } from '@/components/FocusKpis'
import { WorkFocus } from './WorkFocus'
import { board } from '@/lib/engine'
import { ASSIGN_STAGES } from '@/data/org'
import { AVAIL, STAFF } from '@/data/people'

const COLS = '180px 150px 1fr 90px 90px 90px'

/** Staff workload: the whole roster, then one person at a time. */
export function ByStaff({ initial, onOpenDept }: { initial?: string; onOpenDept: (d: string) => void }) {
  const { run, work, worked, totDone, totPend } = board()
  useReportExport(() => workloadCsv(worked, false))
  const navigate = useNavigate()
  const [sel, setSel] = useState(initial ?? 'all')
  const [focus, setFocus] = useState('all')
  const { filter, setFilter, query, setQuery, match } = useWorkFilter()

  const picker = (
    <select
      className="inp"
      style={{ minWidth: 210 }}
      aria-label="Staff member"
      value={sel}
      onChange={(e) => setSel(e.target.value)}
    >
      <option value="all">All staff — {worked.length} people</option>
      {worked.map((x) => (
        <option key={x.s.id} value={x.s.id}>
          {x.s.n} — {x.done} done, {x.pend} pending
        </option>
      ))}
    </select>
  )

  const r = sel !== 'all' ? work[sel] : null

  if (!r) {
    const byDep: Record<string, typeof worked> = {}
    worked.forEach((x) =>
      x.s.dep.forEach((d) => {
        ;(byDep[d] = byDep[d] ?? []).push(x)
      }),
    )

    return (
      <>
        <EmbedHead
          title="Staff workload"
          sub={`Today's ${run.today.length} orders across ${worked.length} people. Completed means that person finished their stage.`}
          actions={picker}
        />

        <FocusKpis
          focus={focus}
          onFocus={setFocus}
          cards={[
            {
              key: 'all',
              title: 'Stage tasks today',
              value: totDone + totPend,
              detail: `across ${worked.length} people`,
              count: totDone + totPend,
            },
            {
              key: 'done',
              title: 'Completed',
              value: <span className="ok">{totDone}</span>,
              detail: `${totDone + totPend ? Math.round((totDone / (totDone + totPend)) * 100) : 0}% of the day`,
              count: totDone,
            },
            {
              key: 'pend',
              title: 'Still pending',
              value: totPend,
              tone: 'warn',
              detail: <span className="warn">on someone's desk now</span>,
              count: totPend,
            },
            {
              key: 'idle',
              title: 'Nobody idle',
              value: worked.filter((x) => x.pend > 0).length,
              detail: 'people with work in hand',
              count: STAFF.filter((x) => x.dep.length).length,
            },
          ]}
        />

        {focus !== 'all' ? (
          <WorkFocus focus={focus} mode="staff" onBack={() => setFocus('all')} />
        ) : (
          <>
        <SectionHead>Everyone — completed against pending</SectionHead>
        <FlexTable
          cols={COLS}
          min={900}
          head={['Staff', 'Departments', 'Completed / pending', 'Done', 'Pending', 'Total']}
        >
          {worked.map((x) => (
            <FlexRow cols={COLS} key={x.s.id} onClick={() => setSel(x.s.id)}>
              <Cell>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar
                    name={x.s.n}
                    title={`Open ${x.s.n}`}
                    onClick={() => navigate({ to: '/staff/$personId', params: { personId: x.s.id } })}
                  />
                  <div className="v">{x.s.n}</div>
                </div>
                {x.s.avail !== 'ok' ? <div className="s">{AVAIL[x.s.avail][0]}</div> : null}
              </Cell>
              <Cell v={x.s.dep.join(', ')} tone="gr" />
              <Cell>
                <div className="split">
                  <span style={{ width: `${x.pct}%`, background: 'var(--ok)' }} />
                  <span style={{ width: `${100 - x.pct}%`, background: 'var(--warn)' }} />
                </div>
                <div className="s">{x.pct}% complete</div>
              </Cell>
              <Cell v={x.done} mono tone="ok" />
              <Cell v={x.pend} mono tone={x.pend ? 'warn' : 'gr'} />
              <Cell v={x.tot} mono />
            </FlexRow>
          ))}
        </FlexTable>
        <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
          Green is completed, amber still pending. Click anyone for their orders.
        </p>

        <SectionHead>By department</SectionHead>
        <Kpis>
          {ASSIGN_STAGES.map((d) => {
            const list = byDep[d] ?? []
            const dn = list.reduce((a, x) => a + (x.stages[d]?.done ?? 0), 0)
            const pd = list.reduce((a, x) => a + (x.stages[d]?.pend ?? 0), 0)
            return (
              <Kpi
                key={d}
                title={d}
                value={dn + pd}
                onClick={() => onOpenDept(d)}
                detail={
                  <>
                    <span className="ok">{dn} done</span> <span className="gr">·</span>{' '}
                    <span className={pd ? 'warn' : 'gr'}>{pd} pending</span>
                  </>
                }
              />
            )
          })}
        </Kpis>
          </>
        )}
      </>
    )
  }

  const openOrder = (orderId: string) => navigate({ to: '/orders/$orderId', params: { orderId } })
  const items = match(r.items)

  return (
    <>
      <Btn variant="ghost" small style={{ marginBottom: 14 }} onClick={() => setSel('all')}>
        ← All staff
      </Btn>
      <EmbedHead
        title={r.s.n}
        sub={`${r.s.dep.join(', ')} · target ${r.s.cap} a day · ${AVAIL[r.s.avail][0]}`}
        actions={
          <>
            <Btn
              variant="ghost"
              small
              onClick={() => navigate({ to: '/staff/$personId', params: { personId: r.s.id } })}
            >
              Full profile
            </Btn>
            {picker}
          </>
        }
      />

      <Kpis>
        <Kpi title="Assigned today" value={r.tot} detail={`of a ${r.s.cap} target`} />
        <Kpi title="Completed" value={<span className="ok">{r.done}</span>} detail={`${r.pct}%`} />
        <Kpi
          title="Pending"
          value={r.pend}
          tone={r.pend ? 'warn' : undefined}
          detail={<span className={r.pend ? 'warn' : 'ok'}>{r.pend ? 'still on their desk' : 'nothing outstanding'}</span>}
        />
        {/* Against the load the engine is actually tracking for this person, not
            against today's stage-task count — they are different quantities, and
            the department table opposite uses the load. */}
        <Kpi
          title="Room left"
          value={Math.max(0, r.s.cap - (run.load[r.s.id] ?? 0))}
          detail={
            (run.load[r.s.id] ?? 0) >= r.s.cap ? (
              <span className="warn">at target</span>
            ) : (
              'before the target'
            )
          }
        />
      </Kpis>

      <SectionHead>By stage</SectionHead>
      <Card padded>
        {Object.entries(r.stages).map(([stage, v]) => {
          const pct = v.done + v.pend ? Math.round((v.done / (v.done + v.pend)) * 100) : 0
          return (
            <div
              key={stage}
              style={{
                display: 'grid',
                gridTemplateColumns: '130px 1fr 130px',
                gap: 12,
                alignItems: 'center',
                padding: '7px 0',
                fontSize: '12.5px',
              }}
            >
              <span>{stage}</span>
              <span className="split">
                <span style={{ width: `${pct}%`, background: 'var(--ok)' }} />
                <span style={{ width: `${100 - pct}%`, background: 'var(--warn)' }} />
              </span>
              <span className="mono gr" style={{ textAlign: 'right', fontSize: '11.5px' }}>
                <span className="ok">{v.done}</span> / <span className="warn">{v.pend}</span>
              </span>
            </div>
          )
        })}
        <p className="gr" style={{ fontSize: '11.5px', marginTop: 10 }}>
          Completed / pending per stage this person works.
        </p>
      </Card>

      <SectionHead>Their orders</SectionHead>
      <WorkFilter
        filter={filter}
        onFilter={setFilter}
        counts={{ all: r.tot, done: r.done, pend: r.pend }}
        query={query}
        onQuery={setQuery}
        shown={items.length}
        total={r.tot}
      />
      <WorkTable
        cols={WORKCOLS.stage}
        min={760}
        head={['Order', 'Stage', 'Product', 'State', 'Arrived', 'Status']}
        empty={
          items.length
            ? null
            : {
                icon: '✓',
                text: `Nothing ${filter === 'done' ? 'completed' : 'pending'} for ${r.s.n}.`,
              }
        }
      >
        {items.map((i, idx) => (
          <WorkRow key={`${i.o.id}-${idx}`} item={i} mode="stage" onOpen={openOrder} />
        ))}
      </WorkTable>
    </>
  )
}

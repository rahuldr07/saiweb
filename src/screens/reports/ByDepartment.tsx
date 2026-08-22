import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Avatar, Banner, Btn, Card, Kpi, Kpis, EmbedHead, SectionHead } from '@/components/ui'
import { WorkFilter, WorkRow, WorkTable, WORKCOLS, useWorkFilter } from './WorkRows'
import { workloadCsv } from '@/lib/report-csv'
import { useReportExport } from './useReportExport'
import { Cell, FlexRow, FlexTable } from '@/components/FlexTable'
import { FocusKpis } from '@/components/FocusKpis'
import { WorkFocus } from './WorkFocus'
import { board } from '@/lib/engine'
import { AVAIL } from '@/data/people'

/** The bar fill: green all the way up to the point it starts to matter. */
const capTone = (pct: number) => (pct >= 95 ? 'var(--bad)' : pct >= 80 ? 'var(--warn)' : 'var(--ok)')

/** The figure beside it, which the design leaves grey until it matters. */
const capTextTone = (pct: number) => (pct >= 95 ? 'bad' : pct >= 80 ? 'warn' : 'gr')

const PEOPLE_COLS = '190px 1fr 85px 85px 130px'

/** Departmental workload: the whole floor, then one department at a time. */
export function ByDepartment({ initial, onOpenStaff }: { initial?: string; onOpenStaff: (id: string) => void }) {
  const { run, depts, dwork } = board()
  useReportExport(() => workloadCsv(depts, true))
  const navigate = useNavigate()
  const [sel, setSel] = useState(initial ?? 'all')
  const [focus, setFocus] = useState('all')
  const { filter, setFilter, query, setQuery, match } = useWorkFilter()

  const picker = (
    <select
      className="inp"
      style={{ minWidth: 230 }}
      aria-label="Department"
      value={sel}
      onChange={(e) => setSel(e.target.value)}
    >
      <option value="all">All departments — {depts.length}</option>
      {depts.map((x) => (
        <option key={x.d} value={x.d}>
          {x.d} — {x.done} done, {x.pend} pending
        </option>
      ))}
    </select>
  )

  const r = sel !== 'all' ? dwork[sel] : null

  if (!r) {
    const td = depts.reduce((a, x) => a + x.done, 0)
    const tp = depts.reduce((a, x) => a + x.pend, 0)
    const tu = depts.reduce((a, x) => a + x.unplaced, 0)
    const thin = depts.filter((x) => x.avail <= 1)

    return (
      <>
        <EmbedHead
          title="Department workload"
          sub={`Today's ${run.today.length} orders across ${depts.length} departments.`}
          actions={picker}
        />

        {thin.length ? (
          <Banner
            kind="d"
            icon="⚠"
            title={`${thin.map((x) => x.d).join(' and ')} ${thin.length === 1 ? 'has' : 'have'} one person or none available`}
          >
            {thin.map((x) => `${x.d}: ${x.staff.length} member${x.staff.length === 1 ? '' : 's'}, ${x.avail} available today.`).join(' ')}{' '}
            A department this thin stops the moment that person is away.
          </Banner>
        ) : null}

        <FocusKpis
          focus={focus}
          onFocus={setFocus}
          cards={[
            {
              key: 'all',
              title: 'Stage tasks today',
              value: td + tp,
              detail: `across ${depts.filter((x) => x.tot).length} active departments`,
              count: td + tp,
            },
            {
              key: 'done',
              title: 'Completed',
              value: <span className="ok">{td}</span>,
              detail: `${td + tp ? Math.round((td / (td + tp)) * 100) : 0}% of the day`,
              count: td,
            },
            {
              key: 'pend',
              title: 'Still pending',
              value: tp,
              tone: 'warn',
              detail: <span className="warn">in a queue right now</span>,
              count: tp,
            },
            {
              key: 'exc',
              title: 'Never placed',
              value: tu,
              tone: tu ? 'alert' : undefined,
              detail: (
                <span className={tu ? 'bad' : 'ok'}>{tu ? 'no one could take them' : 'none'}</span>
              ),
              count: tu,
            },
          ]}
        />

        {focus !== 'all' ? (
          <WorkFocus focus={focus} mode="dept" onBack={() => setFocus('all')} />
        ) : (
          <>
        <SectionHead>Every department — completed against pending</SectionHead>
        <FlexTable
          cols="150px 110px 1fr 85px 85px 85px 130px"
          min={1000}
          head={['Department', 'People', 'Completed / pending', 'Done', 'Pending', 'Unplaced', 'Capacity used']}
        >
          {depts.map((x) => {
            const cu = x.cap ? Math.round((x.load / x.cap) * 100) : 0
            return (
              <FlexRow
                cols="150px 110px 1fr 85px 85px 85px 130px"
                key={x.d}
                onClick={() => setSel(x.d)}
              >
                <Cell v={<b>{x.d}</b>} s={x.auto ? undefined : 'exception branch'} />
                <Cell
                  v={
                    <>
                      {x.avail}
                      <span className="gr"> / {x.staff.length}</span>
                    </>
                  }
                  s="available"
                  mono
                />
                <Cell>
                  {x.tot ? (
                    <>
                      <div className="split">
                        <span style={{ width: `${x.pct}%`, background: 'var(--ok)' }} />
                        <span style={{ width: `${100 - x.pct}%`, background: 'var(--warn)' }} />
                      </div>
                      <div className="s">{x.pct}% complete</div>
                    </>
                  ) : (
                    <span className="gr" style={{ fontSize: '12.5px' }}>
                      not auto-assigned
                    </span>
                  )}
                </Cell>
                <Cell v={x.done || '—'} mono tone="ok" />
                <Cell v={x.pend || '—'} mono tone={x.pend ? 'warn' : 'gr'} />
                <Cell v={x.unplaced || '—'} mono tone={x.unplaced ? 'bad' : 'gr'} />
                <Cell>
                  <span className="bar" style={{ display: 'block' }}>
                    <i style={{ width: `${Math.min(100, cu)}%`, background: capTone(cu) }} />
                  </span>
                  <div className="s">
                    {x.load} of {x.cap}
                  </div>
                </Cell>
              </FlexRow>
            )
          })}
        </FlexTable>
        <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
          Doc Req shows no tasks because it is an exception branch — work only enters it when an order needs a
          document, so it is never part of the automatic pass.
        </p>
          </>
        )}
      </>
    )
  }

  const openOrder = (orderId: string) => navigate({ to: '/orders/$orderId', params: { orderId } })
  const items = match(r.items)
  const cu = r.cap ? Math.round((r.load / r.cap) * 100) : 0

  return (
    <>
      <Btn variant="ghost" small style={{ marginBottom: 14 }} onClick={() => setSel('all')}>
        ← All departments
      </Btn>
      <EmbedHead
        title={r.d}
        sub={`${r.staff.length} member${r.staff.length === 1 ? '' : 's'} · ${r.avail} available today · ${r.auto ? 'part of the automatic pass' : 'exception branch, assigned on demand'}`}
        actions={picker}
      />

      {r.avail <= 1 ? (
        <Banner kind="d" icon="⚠" title={`${r.avail ? 'One person' : 'Nobody'} available in ${r.d}`}>
          {r.staff.map((s) => `${s.n} — ${AVAIL[s.avail][0].toLowerCase()}`).join(', ')}.{' '}
          {r.avail ? 'If they are away, this stage stops.' : 'Anything needing this stage today has nowhere to go.'}
        </Banner>
      ) : null}

      <Kpis>
        <Kpi title="Assigned today" value={r.tot} detail="" />
        <Kpi title="Completed" value={<span className="ok">{r.done}</span>} detail={`${r.pct}%`} />
        <Kpi
          title="Pending"
          value={r.pend}
          tone={r.pend ? 'warn' : undefined}
          detail={<span className={r.pend ? 'warn' : 'ok'}>{r.pend ? 'in the queue' : 'clear'}</span>}
        />
        <Kpi
          title="Never placed"
          value={r.unplaced}
          tone={r.unplaced ? 'alert' : undefined}
          detail={
            <span className={r.unplaced ? 'bad' : 'ok'}>
              {r.unplaced ? 'became exceptions' : 'none'}
            </span>
          }
        />
        <Kpi
          title="Capacity used"
          value={`${cu}%`}
          detail={
            <span className={capTextTone(cu)}>
              {r.load} of {r.cap}
            </span>
          }
        />
      </Kpis>

      <SectionHead>Who is in {r.d}</SectionHead>
      <Card>
        <div className="tsc">
          <div style={{ minWidth: 700 }}>
            <div className="trow h" style={{ gridTemplateColumns: PEOPLE_COLS }}>
              <span>Person</span>
              <span>Completed / pending</span>
              <span>Done</span>
              <span>Pending</span>
              <span>Load</span>
            </div>
            <div className="tb">
              {/* Every member, not only those who were given something — a name
                  with nothing against it is the useful signal here. */}
              {r.staff.map((s) => {
                const v = r.people[s.id] ?? { done: 0, pend: 0 }
                const tt = v.done + v.pend
                const pct = tt ? Math.round((v.done / tt) * 100) : 0
                return (
                  <div
                    className="trow"
                    key={s.id}
                    role="button"
                    tabIndex={0}
                    style={{ gridTemplateColumns: PEOPLE_COLS }}
                    onClick={() => onOpenStaff(s.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onOpenStaff(s.id)
                      }
                    }}
                  >
                    <div className="cell">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar
                          name={s.n}
                          title={`Open ${s.n}`}
                          onClick={() => navigate({ to: '/staff/$personId', params: { personId: s.id } })}
                        />
                        <div className="v">{s.n}</div>
                      </div>
                      {s.avail !== 'ok' ? <div className="s bad">{AVAIL[s.avail][0]}</div> : null}
                    </div>
                    <div className="cell">
                      {tt ? (
                        <div className="split">
                          <span style={{ width: `${pct}%`, background: 'var(--ok)' }} />
                          <span style={{ width: `${100 - pct}%`, background: 'var(--warn)' }} />
                        </div>
                      ) : (
                        <span className="gr" style={{ fontSize: '12.5px' }}>
                          {s.avail === 'ok' ? 'nothing assigned today' : 'unavailable'}
                        </span>
                      )}
                    </div>
                    <div className="cell">
                      <div className="v mono ok">{v.done || '—'}</div>
                    </div>
                    <div className="cell">
                      <div className={`v mono ${v.pend ? 'warn' : 'gr'}`}>{v.pend || '—'}</div>
                    </div>
                    <div className="cell">
                      <div className="v mono">
                        {run.load[s.id] ?? 0}
                        <span className="gr"> / {s.cap}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Card>

      <SectionHead>Orders at this stage</SectionHead>
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
        cols={WORKCOLS.who}
        min={800}
        head={['Order', 'Owner', 'Product', 'State', 'Arrived', 'Status']}
        empty={
          items.length
            ? null
            : {
                icon: r.auto ? '✓' : '○',
                text: r.auto
                  ? `Nothing ${filter === 'done' ? 'completed' : 'pending'} in ${r.d}.`
                  : `${r.d} is an exception branch — work only arrives when an order needs it.`,
              }
        }
      >
        {items.map((i, idx) => (
          <WorkRow key={`${i.o.id}-${idx}`} item={i} mode="who" onOpen={openOrder} />
        ))}
      </WorkTable>
    </>
  )
}

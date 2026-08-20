import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Avatar, Btn, Kpi, Kpis, PageHead, SectionHead } from '@/components/ui'
import { Cell, FlexRow, FlexTable } from '@/components/FlexTable'
import { FocusKpis } from '@/components/FocusKpis'
import { board } from '@/lib/engine'
import { ASSIGN_STAGES } from '@/data/org'
import { AVAIL, STAFF } from '@/data/people'

const COLS = '180px 150px 1fr 90px 90px 90px'

/** Staff workload: the whole roster, then one person at a time. */
export function ByStaff() {
  const { run, work, worked, totDone, totPend } = board()
  const navigate = useNavigate()
  const [sel, setSel] = useState('all')
  const [focus, setFocus] = useState('all')
  const [itemFilter, setItemFilter] = useState('all')

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
        <PageHead
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
    )
  }

  const items = r.items.filter((i) => (itemFilter === 'all' ? true : itemFilter === 'done' ? i.fin : !i.fin))

  return (
    <>
      <Btn variant="ghost" small style={{ marginBottom: 14 }} onClick={() => setSel('all')}>
        ← All staff
      </Btn>
      <PageHead
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
          detail={<span className={r.pend ? 'warn' : 'ok'}>{r.pend ? 'still in hand' : 'clear'}</span>}
        />
        <Kpi
          title="Room left"
          value={Math.max(0, r.s.cap - r.tot)}
          detail={r.tot >= r.s.cap ? <span className="warn">at target</span> : 'before the target'}
        />
      </Kpis>

      <SectionHead>By stage</SectionHead>
      <Kpis>
        {Object.entries(r.stages).map(([stage, v]) => (
          <Kpi
            key={stage}
            title={stage}
            value={v.done + v.pend}
            detail={
              <>
                <span className="ok">{v.done} done</span> <span className="gr">·</span>{' '}
                <span className={v.pend ? 'warn' : 'gr'}>{v.pend} pending</span>
              </>
            }
          />
        ))}
      </Kpis>

      <div className="fbar" style={{ marginTop: 16 }} role="group" aria-label="Filter tasks">
        {[
          ['all', `Everything (${r.items.length})`],
          ['done', `Completed (${r.done})`],
          ['pend', `Pending (${r.pend})`],
        ].map(([k, label]) => (
          <button
            key={k}
            className={`pill ${itemFilter === k ? 'on' : ''}`}
            aria-pressed={itemFilter === k}
            onClick={() => setItemFilter(k)}
          >
            {label}
          </button>
        ))}
      </div>

      <FlexTable
        cols="150px 130px 140px 1fr 110px"
        min={800}
        head={['Order', 'Client', 'Product', 'Stage', 'State']}
      >
        {items.map((i, idx) => (
          <FlexRow cols="150px 130px 140px 1fr 110px" key={`${i.o.id}-${idx}`}>
            <Cell v={i.o.id} mono s={i.fin ? 'completed' : 'pending'} />
            <Cell v={i.o.cl} />
            <Cell v={i.o.pr} />
            <Cell v={i.stage} tone={i.fin ? 'ok' : undefined} />
            <Cell v={i.o.st} mono />
          </FlexRow>
        ))}
      </FlexTable>
    </>
  )
}

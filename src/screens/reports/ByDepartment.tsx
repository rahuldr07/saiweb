import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Banner, Btn, Card, Kpi, Kpis, PageHead, SectionHead } from '@/components/ui'
import { Cell, FlexRow, FlexTable } from '@/components/FlexTable'
import { FocusKpis } from '@/components/FocusKpis'
import { WorkFocus } from './WorkFocus'
import { board } from '@/lib/engine'
import { AVAIL, STAFF } from '@/data/people'
import { whoName } from '@/lib/permissions'

const capTone = (pct: number) => (pct >= 95 ? 'var(--bad)' : pct >= 80 ? 'var(--warn)' : 'var(--ok)')

/** Departmental workload: the whole floor, then one department at a time. */
export function ByDepartment({ initial }: { initial?: string }) {
  const { run, depts, dwork } = board()
  const navigate = useNavigate()
  const [sel, setSel] = useState(initial ?? 'all')
  const [focus, setFocus] = useState('all')
  const [itemFilter, setItemFilter] = useState('all')

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
        <PageHead
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

  const items = r.items.filter((i) => (itemFilter === 'all' ? true : itemFilter === 'done' ? i.fin : !i.fin))
  const ppl = Object.entries(r.people)
    .map(([id, v]) => ({ id, ...v, tot: v.done + v.pend }))
    .sort((a, b) => b.tot - a.tot)
  const cu = r.cap ? Math.round((r.load / r.cap) * 100) : 0

  return (
    <>
      <Btn variant="ghost" small style={{ marginBottom: 14 }} onClick={() => setSel('all')}>
        ← All departments
      </Btn>
      <PageHead
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
            <span style={{ color: capTone(cu) }}>
              {r.load} of {r.cap}
            </span>
          }
        />
      </Kpis>

      <SectionHead>Who is carrying it</SectionHead>
      <Card>
        <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
          {ppl.map((p) => {
            const person = STAFF.find((s) => s.id === p.id)
            return (
              <div className="rw" key={p.id}>
                <span className="gr">·</span>
                <span>
                  <b>{whoName(p.id)}</b>
                  <div className="sd">
                    {p.done} done · {p.pend} pending
                    {person && person.avail !== 'ok' ? ` · ${AVAIL[person.avail][0].toLowerCase()}` : ''}
                  </div>
                </span>
                <span>
                  <Btn
                    variant="ghost"
                    small
                    onClick={() => navigate({ to: '/staff/$personId', params: { personId: p.id } })}
                  >
                    Open
                  </Btn>
                </span>
              </div>
            )
          })}
        </div>
      </Card>

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
        cols="150px 130px 150px 1fr 110px"
        min={800}
        head={['Order', 'Client', 'Product', 'Who has it', 'State']}
      >
        {items.map((i, idx) => (
          <FlexRow cols="150px 130px 150px 1fr 110px" key={`${i.o.id}-${idx}`}>
            <Cell v={i.o.id} mono s={i.fin ? 'completed' : 'pending'} />
            <Cell v={i.o.cl} />
            <Cell v={i.o.pr} />
            <Cell v={whoName(i.who)} tone={i.fin ? 'ok' : undefined} />
            <Cell v={i.o.st} mono />
          </FlexRow>
        ))}
      </FlexTable>
    </>
  )
}

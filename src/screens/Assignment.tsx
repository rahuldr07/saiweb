import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Avatar, Banner, Bar, Card, CardHead, Chip, Empty, Kpi, Kpis, PageHead, SectionHead, Tabs } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { AVAIL, STAFF } from '@/data/people'
import { ASSIGN_STAGES, RULES } from '@/data/org'
import { EXCLUSION, board, type ExclusionReason } from '@/lib/engine'
import { covSummary } from '@/lib/coverage'

const TABS = ['Live', 'Exceptions', 'Capacity', 'Rules'] as const
type Tab = (typeof TABS)[number]

/**
 * The routing engine, shown from four sides. The engine never silently skips a
 * person, so every unplaced stage carries one of five reasons — and the fix for
 * each is different, which is why Exceptions groups by cause rather than by order.
 */
function Assignment() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('Live')

  const { run: RUN, depts: DEPTS, worked: WORKED, totDone: TOT_DONE, totPend: TOT_PEND } = board()
  const todayExc = RUN.exc.filter((e) => e.today)
  const todayAssigns = RUN.assigns.filter((a) => a.today)

  const causes = todayExc.reduce<Record<string, typeof todayExc>>((acc, e) => {
    ;(acc[e.why] = acc[e.why] ?? []).push(e)
    return acc
  }, {})

  return (
    <>
      <PageHead
        title="Assignment"
        sub="Work is placed as it arrives. Every choice records why it was made, and every refusal says which rule stopped it."
      />
      <Kpis>
        <Kpi title="Placed today" value={todayAssigns.length} detail="stages given an owner" />
        <Kpi title="Finished" value={<span className="ok">{TOT_DONE}</span>} detail="through their stage" />
        <Kpi title="On desks" value={<span className="warn">{TOT_PEND}</span>} detail="still in hand" />
        <Kpi
          title="Could not be placed"
          value={<span className={todayExc.length ? 'bad' : 'ok'}>{todayExc.length}</span>}
          tone={todayExc.length ? 'alert' : undefined}
          detail="waiting on a person"
        />
        <Kpi title="Self-review avoided" value={RUN.avoided} detail="QC moved off the author" />
      </Kpis>

      <div style={{ marginTop: 20 }}>
        <Tabs
          tabs={TABS.map((t) => [t, t === 'Exceptions' ? todayExc.length || null : null] as [Tab, number | null])}
          value={tab}
          onChange={setTab}
        />
      </div>

      {tab === 'Live' ? (
        <>
          <SectionHead>Arrivals by hour — today</SectionHead>
          <Card padded>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 140 }}>
              {RUN.hourly.map((h) => {
                const max = Math.max(...RUN.hourly.map((x) => x.n), 1)
                return (
                  <div key={h.hr} style={{ flex: 1, textAlign: 'center' }}>
                    <div
                      title={`${h.hr}:00 — ${h.n} orders`}
                      style={{
                        height: `${(h.n / max) * 108}px`,
                        background: 'var(--brand2)',
                        borderRadius: '5px 5px 0 0',
                      }}
                    />
                    <div className="mono gr" style={{ fontSize: '10.5px', marginTop: 6 }}>
                      {h.hr}
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
              {RUN.today.length} orders arrived today across {ASSIGN_STAGES.length} assignable stages.
            </p>
          </Card>

          <SectionHead>By person — who is holding what</SectionHead>
          <Card>
            <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
              {WORKED.map((r) => (
                <button
                  type="button"
                  className="rw"
                  style={{ width: '100%' }}
                  key={r.s.id}
                  onClick={() => navigate({ to: '/staff/$personId', params: { personId: r.s.id } })}
                >
                  <span>
                    <Avatar name={r.s.n} />
                  </span>
                  <span>
                    <b>{r.s.n}</b>
                    <div className="sd">
                      {r.s.dep.join(', ')} · {covSummary(r.s.id)}
                    </div>
                    <div className="split" style={{ marginTop: 5 }}>
                      <span style={{ width: `${r.pct}%`, background: 'var(--ok)' }} />
                      <span style={{ width: `${100 - r.pct}%`, background: 'var(--warn)' }} />
                    </div>
                  </span>
                  <span className="mono" style={{ fontSize: '12.5px' }}>
                    {r.done}/{r.tot}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        </>
      ) : null}

      {tab === 'Exceptions' ? (
        todayExc.length ? (
          <>
            {Object.entries(causes)
              .sort((a, b) => b[1].length - a[1].length)
              .map(([why, list]) => {
                const [label, tone, fix] = EXCLUSION[why as ExclusionReason]
                return (
                  <div key={why}>
                    <SectionHead>
                      {label} — {list.length}
                    </SectionHead>
                    <Banner kind={tone === 'bad' ? 'd' : 'r'} icon="◷" title="What would clear these">
                      {fix}
                    </Banner>
                    <Card>
                      <div className="tsc">
                        <div style={{ minWidth: 760 }}>
                          <div className="trow h" style={{ gridTemplateColumns: '160px 140px 150px 1fr' }}>
                            <span>Order</span>
                            <span>Stage</span>
                            <span>Client</span>
                            <span>What happened</span>
                          </div>
                          <div className="tb">
                            {list.map((e, i) => (
                              <div
                                key={`${e.o.id}-${e.stage}-${i}`}
                                className="trow"
                                style={{ gridTemplateColumns: '160px 140px 150px 1fr' }}
                              >
                                <div className="cell">
                                  <div className="v mono" style={{ fontSize: '12.5px' }}>
                                    {e.o.id}
                                  </div>
                                  <div className="s">{e.o.pr}</div>
                                </div>
                                <div className="cell">
                                  <div className="v" style={{ fontSize: '12.5px' }}>
                                    {e.stage}
                                  </div>
                                </div>
                                <div className="cell">
                                  <div className="v" style={{ fontSize: '12.5px' }}>
                                    {e.o.cl}
                                  </div>
                                </div>
                                <div className="cell">
                                  <div className="v" style={{ fontSize: '12.5px' }}>
                                    {e.t}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                )
              })}
            <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
              Every one of these arrived today and found no home. They are not lost — they are waiting for a
              person to place them by hand.
            </p>
          </>
        ) : (
          <Card>
            <Empty icon="✓">Every stage that arrived today found an owner.</Empty>
          </Card>
        )
      ) : null}

      {tab === 'Capacity' ? (
        <>
          <SectionHead>By department</SectionHead>
          <Card>
            <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
              {DEPTS.map((d) => (
                <div className="rw" key={d.d}>
                  <span className={d.avail ? 'gr' : 'bad'} style={{ fontSize: '14.5px' }}>
                    {d.avail ? '◱' : '⚑'}
                  </span>
                  <span>
                    <b>{d.d}</b>
                    <div className="sd">
                      {d.avail} of {d.staff.length} available · room for {d.cap}, carrying {d.load}
                      {d.unplaced ? <span className="bad"> · {d.unplaced} unplaced</span> : null}
                    </div>
                    <div style={{ marginTop: 5 }}>
                      <Bar value={d.load} max={Math.max(d.cap, 1)} />
                    </div>
                  </span>
                  <span className="mono" style={{ fontSize: '12.5px' }}>
                    {d.done}/{d.tot}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <SectionHead>By person</SectionHead>
          <Card>
            <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
              {STAFF.filter((s) => s.dep.length).map((s) => (
                <div className="rw" key={s.id}>
                  <span>
                    <Avatar name={s.n} />
                  </span>
                  <span>
                    <b>{s.n}</b>
                    <div className="sd">{s.dep.join(', ')}</div>
                    <div style={{ marginTop: 5 }}>
                      <Bar value={RUN.load[s.id] ?? s.open} max={s.cap} />
                    </div>
                  </span>
                  <span>
                    <Chip kind={AVAIL[s.avail][1]}>{AVAIL[s.avail][0]}</Chip>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : null}

      {tab === 'Rules' ? (
        <Card>
          <CardHead title="The rules, in the order they run" />
          <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
            {RULES.map((r) => (
              <div className="rw" key={r.id}>
                <span className={r.on ? 'ok' : 'gr'} style={{ fontSize: '14.5px' }}>
                  {r.on ? '✓' : '·'}
                </span>
                <span>
                  <b>{r.n}</b>
                  <div className="sd">
                    {r.when ? `When ${r.when} — ` : ''}
                    {r.then}
                  </div>
                  <div className="sd gr">
                    consulted {RUN.fired[r.id] ?? 0} times · changed the answer {RUN.narrowed[r.id] ?? 0}
                  </div>
                </span>
                <span>
                  <Chip kind={r.k === 'block' ? 'd' : r.k === 'cover' ? 'r' : r.k === 'route' ? 'b' : 'v'}>
                    {r.k}
                  </Chip>
                </span>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </>
  )
}

export default function AssignmentRoute() {
  return (
    <RequireCap cap="assign">
      <Assignment />
    </RequireCap>
  )
}

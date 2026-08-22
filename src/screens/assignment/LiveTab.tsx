import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Avatar, Btn, Card, Chip, Kpi, Kpis, SectionHead, focusSection } from '@/components/ui'
import { useUi } from '@/state/ui'
import { ASSIGN_STAGES } from '@/data/org'
import { whoName } from '@/lib/permissions'
import { initials } from '@/lib/format'
import { RULE_KIND } from '@/lib/rules'
import type { AssignmentBoard, Arrival } from '@/lib/engine'
import type { Rule } from '@/data/types'

/**
 * The board as it fills.
 *
 * Every order is placed across all five stages the moment it lands, so the thing
 * worth showing is not a queue but a record: what arrived, where each stage went,
 * and — one click in — the rule-by-rule reasoning that put each name there.
 */

const COLS = '130px 80px 90px 80px repeat(5, minmax(96px, 1fr))'

/** The arrivals chart, which three of the four tiles point at rather than repeat. */
const ARRIVALS = 'as-arrivals'
const focusArrivals = () => focusSection(ARRIVALS)

export function LiveTab({
  board,
  rules,
  onTab,
}: {
  board: AssignmentBoard
  rules: Rule[]
  onTab: (t: 'Exceptions' | 'Rules') => void
}) {
  const navigate = useNavigate()
  const { openModal, closeModal } = useUi()
  const [hour, setHour] = useState<number | null>(null)

  const { run } = board
  const orders = run.today
  const assigns = run.assigns.filter((a) => a.today)
  const exc = run.exc.filter((e) => e.today)
  const total = orders.length * ASSIGN_STAGES.length
  const peak = Math.max(...run.hourly.map((x) => x.n), 1)

  /* Filtered to an hour, or the most recent fourteen — newest first, because the
     question this table answers is almost always "what just happened". */
  const shown = hour ? orders.filter((o) => o.hr === hour) : orders.slice(-14).reverse()

  /** The rule-by-rule trace, per stage, for one order. */
  const showTrace = (o: Arrival) => {
    const per = new Map(run.assigns.filter((a) => a.o.id === o.id).map((a) => [a.stage, a]))

    openModal({
      title: `How ${o.id} was assigned`,
      body: (
        <>
          <p className="gr" style={{ fontSize: '12.5px', marginBottom: 15 }}>
            {o.cl} · {o.pr} · {o.st} · arrived {o.hr}:00. Each stage was decided independently, in
            order.
          </p>
          {ASSIGN_STAGES.map((s) => {
            const a = per.get(s)
            const e = run.exc.find((x) => x.o.id === o.id && x.stage === s)
            const steps = a?.trace ?? e?.trace ?? []
            return (
              <Card key={s} style={{ marginBottom: 11 }}>
                <div className="ch" style={{ padding: '11px 15px' }}>
                  <h2 style={{ fontSize: '13.5px', margin: 0 }}>{s}</h2>
                  <div className="r">
                    {a ? (
                      <>
                        <span className="ava" style={{ width: 22, height: 22, fontSize: '8.5px' }}>
                          {initials(whoName(a.who))}
                        </span>
                        <b style={{ fontSize: '12.5px' }}>{whoName(a.who)}</b>
                      </>
                    ) : (
                      <Chip kind="d">Not placed</Chip>
                    )}
                  </div>
                </div>
                <div className="cb" style={{ padding: '11px 15px' }}>
                  {steps.map((tr, i) => {
                    const rule = rules.find((r) => r.id === tr.r)
                    return (
                      <div
                        key={`${tr.r}-${i}`}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '34px 1fr 60px',
                          gap: 10,
                          alignItems: 'center',
                          padding: '5px 0',
                          fontSize: '12.5px',
                        }}
                      >
                        <span
                          className={`chip ${rule ? RULE_KIND[rule.k][1] : 'n'}`}
                          style={{ fontSize: '9.5px', padding: '1px 6px' }}
                        >
                          {tr.r}
                        </span>
                        <span>{tr.note}</span>
                        <span
                          className="mono gr"
                          style={{ textAlign: 'right', fontSize: '11.5px' }}
                        >
                          {tr.left} left
                        </span>
                      </div>
                    )
                  })}
                  {e ? (
                    <div
                      className="bnr d"
                      style={{ margin: '9px 0 0', padding: '9px 12px', fontSize: '12.5px' }}
                    >
                      <span className="bi">⚑</span>
                      <div>{e.t}</div>
                    </div>
                  ) : null}
                </div>
              </Card>
            )
          })}
        </>
      ),
      footer: (
        <>
          <Btn variant="ghost" onClick={closeModal}>
            Close
          </Btn>
          <Btn
            onClick={() => {
              closeModal()
              onTab('Rules')
            }}
          >
            Open rules
          </Btn>
        </>
      ),
    })
  }

  return (
    <>
      <div className="bnr b">
        <span className="bi">⟳</span>
        <div>
          <div className="bt">Assigning as orders arrive — {orders.length} so far today</div>
          Between 10 and 15 an hour. Each one is placed across all {ASSIGN_STAGES.length} stages the
          moment it lands, so nothing waits for a person to start a batch.
          <div className="bs">
            Exceptions collect in their own queue rather than holding up the rest.
          </div>
        </div>
        <div className="ba">
          <Chip kind="v">Running</Chip>
          <Btn variant="ghost" onClick={() => onTab('Rules')}>
            Rules
          </Btn>
        </div>
      </div>

      <Kpis>
        <Kpi
          title="Arrived today"
          value={orders.length}
          detail={`across ${run.hourly.length} hours`}
          icon="›"
          hint="Every arrival, hour filter cleared"
          onClick={() => {
            setHour(null)
            focusArrivals()
          }}
        />
        <Kpi
          title="Placed"
          value={assigns.length}
          valueTone="ok"
          detail={`of ${total} stages`}
          icon="›"
          hint="Where each stage went"
          onClick={focusArrivals}
        />
        <Kpi
          title="Exceptions"
          value={exc.length}
          tone={exc.length ? 'alert' : undefined}
          detail={exc.length ? 'waiting on a person' : 'none'}
          detailTone={exc.length ? 'bad' : 'ok'}
          icon="›"
          hint="What could not be placed"
          onClick={() => onTab('Exceptions')}
        />
        <Kpi
          title="Self-review avoided"
          value={run.avoided}
          detail="rule working silently"
          detailTone="ok"
          icon="›"
          hint="The rule that did this"
          onClick={() => onTab('Rules')}
        />
      </Kpis>

      <SectionHead id={ARRIVALS}>Arrivals by hour — click to filter</SectionHead>
      <Card padded>
        <div className="hbars">
          {run.hourly.map((h) => {
            const on = hour === h.hr
            return (
              <button
                type="button"
                className="hbar"
                key={h.hr}
                aria-pressed={on}
                title={`${h.n} orders at ${h.hr}:00`}
                onClick={() => setHour(on ? null : h.hr)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              >
                <div className="hbar-n mono">{h.n}</div>
                <div className="hbar-t">
                  <div
                    className={`hbar-f${on ? ' on' : ''}`}
                    style={{
                      height: `${(h.n / peak) * 100}%`,
                      opacity: hour !== null && !on ? 0.35 : 1,
                    }}
                  />
                </div>
                <div className="hbar-l mono">{h.hr}:00</div>
              </button>
            )
          })}
        </div>
      </Card>

      <SectionHead>
        {hour ? `Orders that arrived at ${hour}:00` : 'Most recent orders'} — click one to see why it
        went where it did
      </SectionHead>
      <Card>
        <div className="tsc">
          <div style={{ minWidth: 980 }}>
            <div className="trow h" style={{ gridTemplateColumns: COLS }}>
              <span>Order</span>
              <span>Arrived</span>
              <span>Product</span>
              <span>State</span>
              {ASSIGN_STAGES.map((s) => (
                <span key={s}>{s}</span>
              ))}
            </div>
            <div className="tb">
              {shown.map((o) => (
                <div
                  key={o.id}
                  className="trow"
                  style={{ gridTemplateColumns: COLS }}
                  role="button"
                  tabIndex={0}
                  onClick={() => showTrace(o)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') showTrace(o)
                  }}
                >
                  <div className="cell">
                    <div className="v mono">{o.id}</div>
                    <div className="s">{o.cl}</div>
                  </div>
                  <div className="cell">
                    <div className="v mono">{o.hr}:00</div>
                  </div>
                  <div className="cell">
                    <div className="v">{o.pr}</div>
                  </div>
                  <div className="cell">
                    <div className="v mono">{o.st}</div>
                  </div>
                  {ASSIGN_STAGES.map((s) => {
                    const who = o.plan?.[s]
                    return (
                      <div className="cell" key={s}>
                        {who ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Avatar
                              name={whoName(who)}
                              title={`Open ${whoName(who)}`}
                              style={{ width: 21, height: 21, fontSize: '8.5px' }}
                              onClick={(e) => {
                                e.stopPropagation()
                                navigate({ to: '/staff/$personId', params: { personId: who } })
                              }}
                            />
                            <span className="v" style={{ fontSize: '11.5px' }}>
                              {whoName(who).split(' ')[0]}
                            </span>
                          </div>
                        ) : (
                          <span className="chip d" style={{ fontSize: '10.5px' }}>
                            unplaced
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
      <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
        Every row is one order across all five stages. Click it for the rule-by-rule trace of how each
        name was chosen.
      </p>
    </>
  )
}

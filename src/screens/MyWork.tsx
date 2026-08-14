import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Btn, Card, Chip, Due, Empty, Kpi, Kpis, PageHead, SectionHead } from '@/components/ui'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { ORDERS } from '@/data/production'
import { STAGES, STATUS } from '@/data/org'
import { TZ } from '@/lib/format'
import { now } from '@/lib/clock'

const st = (k: string) => STATUS[k]?.[0] ?? k
const COLS = '140px 120px 1.3fr 140px 180px 110px'

/**
 * The individual's queue — the screen production staff live in. Everything is
 * scoped to the stages assigned to them, and nothing here compares them to a
 * colleague.
 */
export default function MyWork() {
  const { me } = useSession()
  const { toast } = useUi()
  const navigate = useNavigate()
  const [done, setDone] = useState<string[]>([])

  /* One row per stage of work, not per order — an order I both search and type
     is two things on my desk. */
  const mine = ORDERS.flatMap((o) =>
    STAGES.filter((s) => o.a[s] === me.id).map((s) => ({ o, stage: s, key: `${o.id}|${s}` })),
  )

  const outstanding = mine.filter((r) => !done.includes(r.key) && !r.o.done)
  const finished = mine.filter((r) => done.includes(r.key) || r.o.done)
  const late = outstanding.filter((r) => r.o.due < now())

  const markDone = (key: string, label: string) => {
    setDone((d) => [...d, key])
    toast(`${label} — marked done`)
  }

  return (
    <>
      <PageHead
        title="My work"
        sub={`The stages assigned to you across every order. ${me.dep.join(', ') || 'No department'}.`}
      />

      <Kpis>
        <Kpi title="Assigned today" value={mine.length} detail="stages across every order" />
        <Kpi
          title="Done"
          value={<span className="ok">{finished.length}</span>}
          detail="finished and handed on"
        />
        <Kpi
          title="Still on my desk"
          value={<span className={outstanding.length ? 'warn' : 'ok'}>{outstanding.length}</span>}
          detail="waiting on me"
        />
        <Kpi
          title="Late"
          value={<span className={late.length ? 'bad' : 'ok'}>{late.length}</span>}
          tone={late.length ? 'alert' : undefined}
          detail={late.length ? 'the client is already owed an explanation' : 'nothing overdue'}
        />
      </Kpis>

      <SectionHead>Today — {outstanding.length} to do</SectionHead>

      {outstanding.length ? (
        <div className="tbl">
          <div className="tsc">
            <div style={{ minWidth: 900 }}>
              <div className="trow h" style={{ gridTemplateColumns: COLS }}>
                <span>Order</span>
                <span>Product</span>
                <span>Property</span>
                <span>My stage</span>
                <span>Due ({TZ})</span>
                <span />
              </div>
              <div className="tb">
                {outstanding.map((r) => (
                  <div key={r.key} className="trow" style={{ gridTemplateColumns: COLS }}>
                    <div className="cell">
                      <button
                        type="button"
                        className="v mono br"
                        onClick={() => navigate({ to: '/orders/$orderId', params: { orderId: r.o.id } })}
                      >
                        {r.o.id}
                      </button>
                      <div className="s">{r.o.cl}</div>
                    </div>
                    <div className="cell">
                      <div className="v">{r.o.pr}</div>
                    </div>
                    <div className="cell">
                      <div className="v">{r.o.prop}</div>
                      <div className="s">
                        {r.o.co}, {r.o.st}
                      </div>
                    </div>
                    <div className="cell">
                      <Chip kind={r.o.due < now() ? 'd' : 'b'}>{r.stage}</Chip>
                    </div>
                    <div className="cell">
                      <Due at={r.o.due} />
                      <div className="s">{st(r.o.stt)}</div>
                    </div>
                    <div className="cell">
                      <Btn small variant="ghost" onClick={() => markDone(r.key, `${r.o.id} · ${r.stage}`)}>
                        Done
                      </Btn>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Card>
          <Empty icon="✓">
            {mine.length
              ? 'Everything assigned to you is finished.'
              : 'Nothing is assigned to you right now.'}
          </Empty>
        </Card>
      )}

      {finished.length ? (
        <>
          <SectionHead>Already finished — {finished.length}</SectionHead>
          <Card>
            <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
              {finished.map((r) => (
                <div className="rw" key={r.key}>
                  <span className="ok">✓</span>
                  <span>
                    <b className="mono" style={{ fontSize: '12.5px' }}>
                      {r.o.id}
                    </b>
                    <div className="sd">
                      {r.stage} · {r.o.prop}
                    </div>
                  </span>
                  <span>
                    <Chip kind="v">Done</Chip>
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </>
      ) : null}
    </>
  )
}

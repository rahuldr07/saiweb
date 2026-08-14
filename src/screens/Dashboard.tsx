import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Btn, Chip, Due, Empty, Kpi, Kpis, PageHead, SectionHead } from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { useSession } from '@/state/session'
import { ORDERS } from '@/data/production'
import { STAGES, STATUS } from '@/data/org'
import { TZ, fmtDate } from '@/lib/format'
import { now } from '@/lib/clock'
import { ATRISK, OPEN, PASTDUE } from '@/lib/derived'
import { board, curStage, stageCounts } from '@/lib/engine'
import { ONTIMETARGET, onTime30 } from '@/lib/metrics'
import { useDeliveries } from '@/lib/useDeliveries'
import { SkeletonValue } from '@/components/async'

const st = (k: string) => STATUS[k]?.[0] ?? k
const stColor = (k: string) => STATUS[k]?.[1] ?? '#94A3B8'

const COLS = '130px 110px 1.4fr 150px 190px 130px'

function Dashboard() {
  const { tenant } = useSession()
  const navigate = useNavigate()
  const [pipe, setPipe] = useState<string | null>(null)

  const counts = stageCounts(ORDERS)
  const shown = pipe ? ORDERS.filter((o) => o.stt === pipe) : ORDERS.filter((o) => !o.done && o.due < now())

  /* The one figure on this screen derived from the delivery history. It is
     fetched rather than bundled, so the tile shows a placeholder for the moment
     it takes rather than holding the whole dashboard back for it. */
  const history = useDeliveries()
  const ot = useMemo(() => onTime30(history.data ?? []), [history.data])
  const otLoading = history.isPending
  const unassigned = ORDERS.filter((o) => !o.done && Object.values(o.a).every((x) => !x)).length
  const { run: RUN } = board()
  const delivered = RUN.today.filter((o) => !curStage(o)).length
  const moving = RUN.today.filter((o) => curStage(o)).length
  const unplaced = RUN.exc.filter((e) => e.today).length

  return (
    <>
      <PageHead
        title="Dashboard"
        sub={`Everything live in ${tenant.name} right now.`}
        actions={
          <>
            <Btn variant="ghost" onClick={() => navigate({ to: '/performance' })}>
              Performance
            </Btn>
            <Btn onClick={() => navigate({ to: '/intake' })}>＋ New order</Btn>
          </>
        }
      />

      <Kpis>
        <Kpi
          title="Past due"
          icon="▲"
          value={PASTDUE}
          tone={PASTDUE ? 'alert' : undefined}
          detail={
            <span className={PASTDUE ? 'bad' : 'ok'}>
              {PASTDUE ? 'client already owed an explanation' : 'nothing overdue'}
            </span>
          }
          onClick={() => navigate({ to: '/orders', search: { pill: 'late' } })}
        />
        <Kpi
          title="Due within 4h"
          icon="◷"
          value={ATRISK}
          tone={ATRISK ? 'warn' : undefined}
          detail={<span className="warn">act now to stay on time</span>}
          onClick={() => navigate({ to: '/orders', search: { pill: 'soon' } })}
        />
        <Kpi
          title="Open orders"
          icon="☰"
          value={OPEN}
          detail={`across ${STAGES.length} stages`}
          onClick={() => navigate({ to: '/orders', search: { pill: 'all' } })}
        />
        <Kpi
          title="Unassigned stages"
          icon="⇄"
          value={unassigned}
          detail="nobody picked them up"
          onClick={() => navigate({ to: '/assign' })}
        />
        <Kpi
          title="On time · 30d"
          icon="✓"
          value={otLoading ? <SkeletonValue /> : ot.pct === null ? '—' : ot.pct.toFixed(1) + '%'}
          tone={!otLoading && ot.pct !== null && ot.pct < ONTIMETARGET ? 'warn' : undefined}
          detail={
            <span className={ot.pct !== null && ot.pct < ONTIMETARGET ? 'warn' : 'ok'}>
              target {ONTIMETARGET}%
            </span>
          }
          onClick={() => navigate({ to: '/performance' })}
        />
      </Kpis>

      <SectionHead>Pipeline — click a stage to filter</SectionHead>
      <div className="pipe">
        {Object.keys(STATUS).map((k) => {
          const n = counts[k] ?? 0
          return (
            <button
              key={k}
              type="button"
              className={`pchip ${pipe === k ? 'on' : ''} ${n ? '' : 'zero'}`}
              aria-pressed={pipe === k}
              onClick={() => setPipe(pipe === k ? null : k)}
            >
              <span className="dt" style={{ background: stColor(k) }} />
              {st(k)}
              <span className="n">{n}</span>
            </button>
          )
        })}
      </div>

      <SectionHead>
        {pipe
          ? `${st(pipe)} — ${shown.length} order${shown.length === 1 ? '' : 's'}`
          : 'Past due — needs attention first'}
      </SectionHead>

      {shown.length ? (
        <div className="tbl">
          <div className="tsc">
            <div style={{ minWidth: 900 }}>
              <div className="trow h" style={{ gridTemplateColumns: COLS }}>
                <span>Order</span>
                <span>Product</span>
                <span>Property</span>
                <span>Stage</span>
                <span>Due ({TZ})</span>
                <span>Age in stage</span>
              </div>
              <div className="tb">
                {shown.map((o) => (
                  <div
                    key={o.id}
                    className="trow"
                    style={{ gridTemplateColumns: COLS }}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate({ to: '/orders/$orderId', params: { orderId: o.id } })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')
                        navigate({ to: '/orders/$orderId', params: { orderId: o.id } })
                    }}
                  >
                    <div className="cell">
                      <div className="v mono">{o.id}</div>
                      <div className="s">{o.cl}</div>
                    </div>
                    <div className="cell">
                      <div className="v">{o.pr}</div>
                    </div>
                    <div className="cell">
                      <div className="v">{o.prop}</div>
                      <div className="s">
                        {o.co}, {o.st}
                      </div>
                    </div>
                    <div className="cell">
                      <Chip kind={o.due < now() && !o.done ? 'd' : 'b'}>{st(o.stt)}</Chip>
                    </div>
                    <div className="cell">
                      <Due at={o.due} />
                    </div>
                    <div className="cell">
                      <div className="v" style={{ fontSize: '12.5px' }}>
                        {o.age}
                      </div>
                      {o.flag ? <div className="s bad">{o.flag}</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="tbl">
          <Empty icon="✓">Nothing past due. The board is clean.</Empty>
        </div>
      )}

      <SectionHead>Today</SectionHead>
      <Kpis>
        <Kpi
          title="Received"
          value={RUN.today.length}
          detail={`${fmtDate(now())} · every client`}
          onClick={() => navigate({ to: '/performance' })}
        />
        <Kpi
          title="Delivered"
          value={<span className="ok">{delivered}</span>}
          detail="through every department"
          onClick={() => navigate({ to: '/performance' })}
        />
        <Kpi
          title="Still moving"
          value={<span className="warn">{moving}</span>}
          tone="warn"
          detail="somewhere in the pipeline"
          onClick={() => navigate({ to: '/performance' })}
        />
        <Kpi
          title="Could not be placed"
          value={<span className={unplaced ? 'bad' : 'ok'}>{unplaced}</span>}
          tone={unplaced ? 'alert' : undefined}
          detail="waiting on a person"
          onClick={() => navigate({ to: '/assign' })}
        />
      </Kpis>
    </>
  )
}

export default function DashboardRoute() {
  return (
    <RequireCap cap="all">
      <Dashboard />
    </RequireCap>
  )
}

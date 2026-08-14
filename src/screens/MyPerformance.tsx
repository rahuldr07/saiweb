import { useMemo } from 'react'
import { Banner, Card, CardHead, Kpi, Kpis, PageHead, Rows, SectionHead } from '@/components/ui'
import { LoadFailed, SkeletonValue } from '@/components/async'
import { useSession } from '@/state/session'
import { board } from '@/lib/engine'
import { ONTIMETARGET } from '@/lib/metrics'
import { useDeliveries } from '@/lib/useDeliveries'
import { fmtDate } from '@/lib/format'
import { now } from '@/lib/clock'

/**
 * Personal performance compares to a target, never to a colleague. There are no
 * leaderboards on this screen by design.
 */
export default function MyPerformance() {
  const { me } = useSession()

  const history = useDeliveries()
  const loading = history.isPending

  /* Only the orders this person actually touched, at any stage. */
  const mine = useMemo(
    () => (history.data ?? []).filter((d) => Object.values(d.by).includes(me.id)),
    [history.data, me.id],
  )
  const late = mine.filter((d) => d.late).length
  const onTime = mine.length ? ((mine.length - late) / mine.length) * 100 : null
  const today = board().work[me.id]

  /* The five days before today, so the bar chart has a shape rather than one column. */
  const byDay = useMemo(
    () =>
      Array.from({ length: 5 }, (_, i) => {
        const d = new Date(now().getFullYear(), now().getMonth(), now().getDate() - (4 - i))
        const key = fmtDate(d)
        return { key, n: mine.filter((x) => x.dk === key).length }
      }),
    [mine],
  )
  const max = Math.max(...byDay.map((b) => b.n), 1)

  if (history.isError) {
    return (
      <>
        <PageHead title="How I’m doing" sub={me.n} />
        <LoadFailed what="Your delivery history" error={history.error} onRetry={() => history.refetch()} />
      </>
    )
  }

  const stages = today
    ? Object.entries(today.stages).map(([stage, v]) => ({ stage, ...v }))
    : []

  return (
    <>
      <PageHead
        title="How I’m doing"
        sub={`${me.n} · ${me.dep.join(', ') || 'No department'}. Measured against your own target, not against anyone else.`}
      />

      {loading ? null : onTime !== null && onTime < ONTIMETARGET ? (
        <Banner kind="r" icon="◷" title="Below the on-time target">
          {onTime.toFixed(1)}% of the orders you touched went out on time, against a target of{' '}
          {ONTIMETARGET}%. The stage that runs over most often is the place to look first.
        </Banner>
      ) : onTime !== null ? (
        <Banner kind="v" icon="✓" title="On target">
          {onTime.toFixed(1)}% on time against a target of {ONTIMETARGET}%.
        </Banner>
      ) : null}

      <Kpis>
        <Kpi title="Assigned today" value={today?.tot ?? 0} detail="stages on your desk" />
        <Kpi title="Finished today" value={<span className="ok">{today?.done ?? 0}</span>} detail={`${today?.pct ?? 0}% of them`} />
        <Kpi
          title="On time"
          value={loading ? <SkeletonValue /> : onTime === null ? '—' : onTime.toFixed(1) + '%'}
          tone={!loading && onTime !== null && onTime < ONTIMETARGET ? 'warn' : undefined}
          detail={`target ${ONTIMETARGET}%`}
        />
        <Kpi
          title="Orders touched"
          value={loading ? <SkeletonValue width={48} /> : mine.length}
          detail="delivered, all time"
        />
      </Kpis>

      <SectionHead>Completed per day</SectionHead>
      <Card padded>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 130 }}>
          {byDay.map((b) => (
            <div key={b.key} style={{ flex: 1, textAlign: 'center' }}>
              <div className="mono gr" style={{ fontSize: '10.5px', marginBottom: 4 }}>
                {b.n}
              </div>
              <div
                title={`${b.key} — ${b.n}`}
                style={{
                  height: `${(b.n / max) * 90}px`,
                  background: 'var(--brand2)',
                  borderRadius: '5px 5px 0 0',
                }}
              />
              <div className="mono gr" style={{ fontSize: '10.5px', marginTop: 6 }}>
                {b.key.slice(0, 5)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {stages.length ? (
        <>
          <SectionHead>By stage, today</SectionHead>
          <Card>
            <CardHead title="What you are carrying" />
            <Rows>
              {stages.map((s) => (
                <div className="rw" key={s.stage}>
                  <span className={s.pend ? 'warn' : 'ok'}>{s.pend ? '◷' : '✓'}</span>
                  <span>
                    <b>{s.stage}</b>
                    <div className="sd">
                      {s.done} finished · {s.pend} still in hand
                    </div>
                  </span>
                  <span className="mono">{s.done + s.pend}</span>
                </div>
              ))}
            </Rows>
          </Card>
        </>
      ) : null}
    </>
  )
}

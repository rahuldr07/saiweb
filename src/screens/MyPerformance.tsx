import { Banner, Card, CardHead, Kpi, Kpis, PageHead, Rows, SectionHead } from '@/components/ui'
import { useSession } from '@/state/session'
import { DELIVERIES } from '@/data/quality'
import { board } from '@/lib/engine'
import { ONTIMETARGET } from '@/lib/metrics'
import { NOW, fmtDate } from '@/lib/format'

/**
 * Personal performance compares to a target, never to a colleague. There are no
 * leaderboards on this screen by design.
 */
export default function MyPerformance() {
  const { me } = useSession()

  const mine = DELIVERIES.filter((d) => Object.values(d.by).includes(me.id))
  const late = mine.filter((d) => d.late).length
  const onTime = mine.length ? ((mine.length - late) / mine.length) * 100 : null
  const today = board().work[me.id]

  /* The five days before today, so the bar chart has a shape rather than one column. */
  const byDay = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - (4 - i))
    const key = fmtDate(d)
    return { key, n: mine.filter((x) => x.dk === key).length }
  })
  const max = Math.max(...byDay.map((b) => b.n), 1)

  const stages = today
    ? Object.entries(today.stages).map(([stage, v]) => ({ stage, ...v }))
    : []

  return (
    <>
      <PageHead
        title="How I’m doing"
        sub={`${me.n} · ${me.dep.join(', ') || 'No department'}. Measured against your own target, not against anyone else.`}
      />

      {onTime !== null && onTime < ONTIMETARGET ? (
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
          value={onTime === null ? '—' : onTime.toFixed(1) + '%'}
          tone={onTime !== null && onTime < ONTIMETARGET ? 'warn' : undefined}
          detail={`target ${ONTIMETARGET}%`}
        />
        <Kpi title="Orders touched" value={mine.length} detail="delivered, all time" />
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

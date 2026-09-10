import { Assumption, Avatar, Btn, Card, Empty, Kpi, Kpis, SectionHead } from '@/components/ui'
import { useUi } from '@/state/ui'
import { useTimeclock } from '@/state/timeclock'
import { TIMECFG } from '@/data/hrms'
import { hm, shiftOf } from '@/lib/workingDay'
import { whoName } from '@/lib/permissions'
import type { Person } from '@/data/types'

const REPEAT_AT = 3

export function LateTab({
  list,
  today,
  filter,
  onFilter,
  openPerson,
}: {
  list: Person[]
  today: Date
  filter: string
  onFilter: (f: string) => void
  openPerson: (id: string) => void
}) {
  const { toast } = useUi()
  const clock = useTimeclock()

  const open = clock.late.filter((x) => !x.waived)
  const waived = clock.late.filter((x) => x.waived)
  const thisMonth = open.filter((x) => x.d.getMonth() === today.getMonth())
  const minsLost = open.reduce((a, x) => a + x.mins, 0)

  const byPerson = list
    .map((p) => {
      const mine = open.filter((x) => x.who === p.id)
      return {
        p,
        n: mine.length,
        mins: mine.reduce((a, x) => a + x.mins, 0),
        worst: mine.reduce((a, x) => Math.max(a, x.mins), 0),
        last: mine[0] ?? null,
      }
    })
    .filter((x) => x.n)
    .sort((a, b) => b.n - a.n)

  const repeat = byPerson.filter((x) => x.n >= REPEAT_AT)
  const rows =
    filter === 'repeat'
      ? open.filter((x) => repeat.some((r) => r.p.id === x.who))
      : filter === 'unexplained'
        ? open.filter((x) => !x.why)
        : filter === 'waived'
          ? waived
          : open

  const filters: [string, string, number][] = [
    ['all', 'All', open.length],
    ['repeat', 'Repeats', open.filter((x) => repeat.some((r) => r.p.id === x.who)).length],
    ['unexplained', 'No reason given', open.filter((x) => !x.why).length],
    ['waived', 'Waived', waived.length],
  ]

  return (
    <>
      <Kpis>
        <Kpi
          title="Late this month"
          value={<span className={thisMonth.length ? 'warn' : 'ok'}>{thisMonth.length}</span>}
          tone={thisMonth.length ? 'warn' : undefined}
          detail={`${open.length} across the last 30 days`}
          onClick={() => onFilter('all')}
        />
        <Kpi title="People affected" value={byPerson.length} detail={`of ${list.length} on the team`} />
        <Kpi
          title="Repeatedly late"
          value={<span className={repeat.length ? 'bad' : 'ok'}>{repeat.length}</span>}
          tone={repeat.length ? 'alert' : undefined}
          detail={`${REPEAT_AT} or more times in the range`}
          onClick={() => onFilter('repeat')}
        />
        <Kpi
          title="Time lost"
          value={hm(minsLost)}
          detail="against shift starts"
          onClick={() => onFilter('unexplained')}
        />
      </Kpis>

      {repeat.length ? (
        <div className="bnr r">
          <span className="bi">◷</span>
          <div>
            <div className="bt">
              {repeat.length} {repeat.length === 1 ? 'person is' : 'people are'} late often enough to be
              a pattern
            </div>
            {repeat.map((x) => `${x.p.n} — ${x.n} times, worst ${x.worst} minutes`).join(' · ')}. A
            pattern is usually a shift that does not fit someone’s commute or household, not a
            discipline problem. The useful next step is asking, and moving them to a shift that works —
            not a warning.
          </div>
        </div>
      ) : (
        <div className="bnr v">
          <span className="bi">✓</span>
          <div>
            <div className="bt">Nobody is repeatedly late</div>
            Every late mark in range is a one-off. Worth leaving alone.
          </div>
        </div>
      )}

      <SectionHead>Person by person</SectionHead>
      <Card>
        <div className="tsc">
          <div style={{ minWidth: 880 }}>
            <div className="trow h" style={{ gridTemplateColumns: '200px 130px 90px 100px 110px 1fr' }}>
              <span>Name</span>
              <span>Shift</span>
              <span>Times</span>
              <span>Total late</span>
              <span>Worst</span>
              <span>Most recent</span>
            </div>
            <div className="tb">
              {byPerson.length ? (
                byPerson.map((x) => {
                  const sh = shiftOf(x.p)
                  return (
                    <div
                      key={x.p.id}
                      className="trow"
                      role="button"
                      tabIndex={0}
                      onClick={() => openPerson(x.p.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') openPerson(x.p.id)
                      }}
                      style={{ gridTemplateColumns: '200px 130px 90px 100px 110px 1fr' }}
                    >
                      <div className="cell">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <Avatar name={x.p.n} />
                          <div className="v">{x.p.n}</div>
                        </div>
                      </div>
                      <div className="cell">
                        <div className="v gr" style={{ fontSize: '12.5px' }}>
                          {sh.n}
                          <div className="mono" style={{ fontSize: '11.5px' }}>
                            from {sh.from}
                          </div>
                        </div>
                      </div>
                      <div className="cell">
                        <div className={`v mono ${x.n >= REPEAT_AT ? 'bad' : ''}`}>{x.n}</div>
                      </div>
                      <div className="cell">
                        <div className="v mono">{hm(x.mins)}</div>
                      </div>
                      <div className="cell">
                        <div className={`v mono ${x.worst >= 45 ? 'warn' : 'gr'}`}>{x.worst}m</div>
                      </div>
                      <div className="cell">
                        <div className="v" style={{ fontSize: '12.5px' }}>
                          {x.last ? `${x.last.dk} · in at ${x.last.at}` : '—'}
                          <div className="s">
                            {x.last?.why ?? <span className="gr">no reason given</span>}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <Empty icon="☰">Nobody has been late in this range.</Empty>
              )}
            </div>
          </div>
        </div>
      </Card>

      <SectionHead>Every late punch</SectionHead>
      <div className="fbar" role="group" aria-label="Filter late logins">
        {filters.map(([k, label, n]) => (
          <button
            key={k}
            type="button"
            className={`pill ${filter === k ? 'on' : ''}`}
            aria-pressed={filter === k}
            onClick={() => onFilter(k)}
          >
            {label} <span className="mono">{n}</span>
          </button>
        ))}
      </div>
      <Card>
        <div className="tsc">
          <div style={{ minWidth: 900 }}>
            <div
              className="trow h"
              style={{ gridTemplateColumns: '110px 180px 120px 100px 90px 1fr 100px' }}
            >
              <span>Date</span>
              <span>Who</span>
              <span>Due in</span>
              <span>Punched</span>
              <span>Late by</span>
              <span>Reason given</span>
              <span />
            </div>
            <div className="tb">
              {rows.length ? (
                rows.map((x) => (
                  <div
                    key={x.id}
                    className="trow"
                    style={{
                      gridTemplateColumns: '110px 180px 120px 100px 90px 1fr 100px',
                      ...(x.waived ? { opacity: 0.55 } : {}),
                    }}
                  >
                    <div className="cell">
                      <div className="v mono">{x.dk}</div>
                    </div>
                    <div className="cell">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={whoName(x.who)} />
                        <div className="v">{whoName(x.who)}</div>
                      </div>
                    </div>
                    <div className="cell">
                      <div className="v mono gr">
                        {x.due}
                        <span style={{ fontSize: '11.5px' }}> · {x.shift}</span>
                      </div>
                    </div>
                    <div className="cell">
                      <div className="v mono">{x.at}</div>
                    </div>
                    <div className="cell">
                      <div className={`v mono ${x.mins >= 45 ? 'bad' : 'warn'}`}>{x.mins}m</div>
                    </div>
                    <div className="cell">
                      <div className="v" style={{ fontSize: '12.5px' }}>
                        {x.why ?? <span className="gr">none</span>}
                      </div>
                    </div>
                    <div className="cell">
                      <Btn
                        variant="ghost"
                        small
                        onClick={() => {
                          const next = !x.waived
                          clock.setWaived(x.id, next)
                          toast(next ? 'Waived — it stays in the log' : 'Waiver removed')
                        }}
                      >
                        {x.waived ? 'Undo' : 'Waive'}
                      </Btn>
                    </div>
                  </div>
                ))
              ) : (
                <Empty icon="☰">Nothing in this filter.</Empty>
              )}
            </div>
          </div>
        </div>
      </Card>
      <Assumption title="Waiving is a record, not an erasure">
        A waived mark stays in the log and in the export — it simply stops counting towards the
        pattern. <b>Attendance figures people cannot see the workings of are the ones they stop
        trusting</b>, so nothing here is deleted, only annotated.
      </Assumption>
      <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
        The grace period is {TIMECFG.lateGraceMins} minutes, set under <b>How it works</b>. A punch
        inside it is not recorded as late at all.
      </p>
    </>
  )
}

import { Avatar, Card, Chip, Kpi, Kpis, SectionHead } from '@/components/ui'
import { useTimeclock } from '@/state/timeclock'
import { ATT, PAYMONTHS } from '@/data/hrms'
import { whoName } from '@/lib/permissions'
import type { Person } from '@/data/types'

export function MonthTab({
  list,
  month,
  onMonth,
  openPerson,
}: {
  list: Person[]
  month: string
  onMonth: (m: string) => void
  openPerson: (id: string) => void
}) {
  const clock = useTimeclock()

  const A = ATT[month] ?? {}
  const tot = list.reduce(
    (a, p) => {
      const x = A[p.id] ?? { present: 0, lop: 0, paidLeave: 0, working: 0 }
      return {
        present: a.present + x.present,
        lop: a.lop + x.lop,
        leave: a.leave + x.paidLeave,
        working: a.working + x.working,
      }
    },
    { present: 0, lop: 0, leave: 0, working: 0 },
  )

  return (
    <>
      <div className="fbar" role="group" aria-label="Month">
        {PAYMONTHS.map((m) => (
          <button
            key={m}
            type="button"
            className={`pill ${month === m ? 'on' : ''}`}
            aria-pressed={month === m}
            onClick={() => onMonth(m)}
          >
            {m}
          </button>
        ))}
      </div>

      <Kpis>
        <Kpi title="Days worked" value={tot.present} detail={`of ${tot.working} possible`} />
        <Kpi title="On leave" value={tot.leave} detail="paid, against balance" />
        <Kpi
          title="Unpaid days"
          value={<span className={tot.lop ? 'warn' : 'ok'}>{tot.lop}</span>}
          tone={tot.lop ? 'warn' : undefined}
          detail="these become payslip deductions"
        />
        <Kpi title="Punches logged" value={clock.punches.length} detail="with location" />
      </Kpis>

      <SectionHead>Person by person</SectionHead>
      <Card>
        <div className="tsc">
          <div style={{ minWidth: 920 }}>
            <div className="trow h" style={{ gridTemplateColumns: '190px 130px 100px 100px 100px 1fr' }}>
              <span>Name</span>
              <span>Department</span>
              <span>Present</span>
              <span>Leave</span>
              <span>Unpaid</span>
              <span>Of the working days</span>
            </div>
            <div className="tb">
              {list.map((p) => {
                const x = A[p.id] ?? { present: 0, lop: 0, paidLeave: 0, working: 0 }
                const pct = x.working ? Math.round((x.present / x.working) * 100) : 0
                return (
                  <div
                    key={p.id}
                    className="trow"
                    role="button"
                    tabIndex={0}
                    onClick={() => openPerson(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') openPerson(p.id)
                    }}
                    style={{ gridTemplateColumns: '190px 130px 100px 100px 100px 1fr' }}
                  >
                    <div className="cell">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar name={p.n} />
                        <div className="v">{p.n}</div>
                      </div>
                    </div>
                    <div className="cell">
                      <div className="v gr" style={{ fontSize: 'var(--t-small)' }}>
                        {p.dep[0] ?? '—'}
                      </div>
                    </div>
                    <div className="cell">
                      <div className="v mono">{x.present}</div>
                    </div>
                    <div className="cell">
                      <div className={`v mono ${x.paidLeave ? '' : 'gr'}`}>{x.paidLeave || '—'}</div>
                    </div>
                    <div className="cell">
                      <div className={`v mono ${x.lop ? 'warn' : 'gr'}`}>{x.lop || '—'}</div>
                    </div>
                    <div className="cell">
                      <span className="split">
                        <span style={{ width: `${pct}%`, background: 'var(--ok)' }} />
                        <span style={{ width: `${100 - pct}%`, background: 'var(--warn)' }} />
                      </span>
                      <div className="s">
                        {pct}% of {x.working}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Card>
      <p className="gr" style={{ fontSize: 'var(--t-small)', marginTop: 10 }}>
        This is the same attendance the payroll run reads. Approve a correction here and the payslip
        for that month moves with it — there is no second set of numbers.
      </p>

      {clock.punches.length ? (
        <>
          <SectionHead>Punch log — {clock.punches.length}</SectionHead>
          <Card>
            <div className="tsc">
              <div style={{ minWidth: 720 }}>
                <div className="trow h" style={{ gridTemplateColumns: '110px 180px 90px 100px 1fr' }}>
                  <span>Date</span>
                  <span>Who</span>
                  <span>Time</span>
                  <span>In or out</span>
                  <span>Where</span>
                </div>
                <div className="tb">
                  {clock.punches.slice(0, 25).map((l, i) => (
                    <div
                      key={`${l.who}-${l.t}-${i}`}
                      className="trow"
                      style={{ gridTemplateColumns: '110px 180px 90px 100px 1fr' }}
                    >
                      <div className="cell">
                        <div className="v mono" style={{ fontSize: 'var(--t-small)' }}>
                          {l.d}
                        </div>
                      </div>
                      <div className="cell">
                        <div className="v" style={{ fontSize: 'var(--t-small)' }}>
                          {whoName(l.who)}
                        </div>
                      </div>
                      <div className="cell">
                        <div className="v mono">{l.t}</div>
                      </div>
                      <div className="cell">
                        <Chip kind={l.kind === 'in' ? 'v' : 'n'}>{l.kind === 'in' ? 'In' : 'Out'}</Chip>
                      </div>
                      <div className="cell">
                        <div className={`v ${l.inside ? '' : 'warn'}`} style={{ fontSize: 'var(--t-small)' }}>
                          {l.inside ? '✓ ' : '◷ '}
                          {l.where}
                          {l.acc ? ` · ±${l.acc} m` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
          <p className="gr" style={{ fontSize: 'var(--t-small)', marginTop: 10 }}>
            Every punch is kept with where it was made. A correction cannot delete one — it adds an
            approved change on top, so the original is still there.
          </p>
        </>
      ) : null}
    </>
  )
}

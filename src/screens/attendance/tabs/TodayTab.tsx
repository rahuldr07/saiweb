import { Btn, Card, Kpi, Kpis, Rows, SectionHead } from '@/components/ui'
import { useUi } from '@/state/ui'
import { useTimeclock } from '@/state/timeclock'
import { shiftOf } from '@/lib/workingDay'
import { whoName } from '@/lib/permissions'
import { fmtDate, initials, pad } from '@/lib/format'
import type { Person } from '@/data/types'

export function TodayTab({
  list,
  today,
  inNow,
  awayToday,
  stateOf,
  openPerson,
}: {
  list: Person[]
  today: Date
  inNow: number
  awayToday: number
  stateOf: (p: Person) => [string, 'v' | 'b' | 'r' | 'n']
  openPerson: (id: string) => void
}) {
  const { toast } = useUi()
  const clock = useTimeclock()

  const groups = new Map<string, Person[]>()
  list.forEach((p) => {
    const d = p.dep[0] ?? '—'
    groups.set(d, [...(groups.get(d) ?? []), p])
  })

  const pendingCorrections = clock.corrections.filter((r) => r.st === 'pending')
  const pendingOt = clock.overtime.filter((o) => o.st === 'pending')
  const pendingSwaps = clock.swaps.filter((s) => s.st === 'pending')

  const punchesToday = clock.punches.filter((l) => l.d === fmtDate(today)).length

  const decide =
    (fn: (id: string, st: 'approved' | 'rejected') => string, id: string, st: 'approved' | 'rejected') =>
    () => {
      const msg = fn(id, st)
      if (msg) toast(msg)
    }

  return (
    <>
      <Kpis>
        <Kpi title="Working now" value={<span className="ok">{inNow}</span>} detail={`of ${list.length} on the team`} />
        <Kpi title="On leave today" value={awayToday} detail="approved and away" />
        <Kpi
          title="Waiting on you"
          value={<span className={clock.waiting ? 'bad' : 'ok'}>{clock.waiting}</span>}
          tone={clock.waiting ? 'alert' : undefined}
          detail={`${pendingCorrections.length} correction${pendingCorrections.length === 1 ? '' : 's'} · ${pendingOt.length} overtime · ${pendingSwaps.length} swap${pendingSwaps.length === 1 ? '' : 's'}`}
        />
        <Kpi title="Punches today" value={punchesToday} detail="in, out and breaks" />
      </Kpis>

      <SectionHead>Today — who is in</SectionHead>
      <Card padded>
        <div className="xscroll" style={{ display: 'flex', gap: 12 }}>
          {[...groups].map(([dept, people]) => {
            const din = people.filter((p) => stateOf(p)[1] === 'v').length
            const off = people.filter((p) => stateOf(p)[0] === 'On leave').length
            return (
              <div key={dept} style={{ flex: 1, minWidth: 190 }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 9,
                  }}
                >
                  <b style={{ fontSize: '13.5px' }}>{dept}</b>
                  <span
                    className={`mono ${din === 0 ? 'bad' : off ? 'warn' : 'gr'}`}
                    style={{ fontSize: '11.5px' }}
                  >
                    {din}/{people.length} in
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {people.map((p) => {
                    const [label] = stateOf(p)
                    const sh = shiftOf(p)
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => openPerson(p.id)}
                        title={`${sh.n} · ${sh.from}–${sh.to}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          textAlign: 'left',
                          background: 'var(--tint)',
                          border: '1px solid var(--hair)',
                          borderRadius: 9,
                          padding: '7px 9px',
                          width: '100%',
                        }}
                      >
                        <span className="ava" style={{ width: 22, height: 22, fontSize: '9.5px' }}>
                          {initials(p.n)}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span
                            style={{
                              fontSize: '12.5px',
                              fontWeight: 600,
                              display: 'block',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {p.n}
                          </span>
                          <span className="gr" style={{ fontSize: '11.5px' }}>
                            {label}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </div>
                {din === 0 ? (
                  <div className="bad" style={{ fontSize: '11.5px', marginTop: 7 }}>
                    Nobody in yet
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
        <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
          Live, and grouped by department because that is the unit that has to be covered. A
          department showing 0 in is the one worth acting on before the queue backs up.
        </p>
      </Card>

      {pendingCorrections.length ? (
        <>
          <SectionHead>Corrections waiting on you — {pendingCorrections.length}</SectionHead>
          <Card>
            <Rows bare>
              {pendingCorrections.map((r) => (
                <div className="rw" key={r.id}>
                  <span className="warn" style={{ fontSize: '14.5px' }}>
                    ◷
                  </span>
                  <span>
                    <b>
                      {whoName(r.who)} — {fmtDate(r.d)}
                    </b>
                    <div className="sd">
                      System recorded: <i>{r.was}</i>. They say: <i>{r.ask}</i>.
                    </div>
                    <div className="sd gr">
                      Approving this changes the day, and therefore the payslip. That is why it is not
                      automatic.
                    </div>
                  </span>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <Btn variant="ghost" small onClick={decide(clock.decideCorrection, r.id, 'rejected')}>
                      Decline
                    </Btn>
                    <Btn small onClick={decide(clock.decideCorrection, r.id, 'approved')}>
                      Approve
                    </Btn>
                  </span>
                </div>
              ))}
            </Rows>
          </Card>
        </>
      ) : null}

      {pendingOt.length ? (
        <>
          <SectionHead>Overtime to approve — {pendingOt.length}</SectionHead>
          <Card>
            <Rows bare>
              {pendingOt.map((o) => (
                <div className="rw" key={o.id}>
                  <span className="warn" style={{ fontSize: '14.5px' }}>
                    ◷
                  </span>
                  <span>
                    <b>
                      {whoName(o.who)} — {Math.floor(o.mins / 60)}h {pad(o.mins % 60)}m on {o.d}
                    </b>
                    <div className="sd">{o.why}</div>
                    <div className="sd gr">
                      Approving this adds the hours to their next payslip at the ordinary rate.
                    </div>
                  </span>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <Btn variant="ghost" small onClick={decide(clock.decideOvertime, o.id, 'rejected')}>
                      Decline
                    </Btn>
                    <Btn small onClick={decide(clock.decideOvertime, o.id, 'approved')}>
                      Approve
                    </Btn>
                  </span>
                </div>
              ))}
            </Rows>
          </Card>
        </>
      ) : null}

      {pendingSwaps.length ? (
        <>
          <SectionHead>Shift swaps — {pendingSwaps.length}</SectionHead>
          <Card>
            <Rows bare>
              {pendingSwaps.map((x) => (
                <div className="rw" key={x.id}>
                  <span className="warn" style={{ fontSize: '14.5px' }}>
                    ⇄
                  </span>
                  <span>
                    <b>
                      {whoName(x.from)} wants {whoName(x.to)} to take {x.d}
                    </b>
                    <div className="sd">{x.why}</div>
                    <div className="sd gr">
                      {whoName(x.to)} has agreed. It needs you because it changes who is covering that
                      day.
                    </div>
                  </span>
                  <span style={{ display: 'flex', gap: 6 }}>
                    <Btn variant="ghost" small onClick={decide(clock.decideSwap, x.id, 'rejected')}>
                      Decline
                    </Btn>
                    <Btn small onClick={decide(clock.decideSwap, x.id, 'approved')}>
                      Approve
                    </Btn>
                  </span>
                </div>
              ))}
            </Rows>
          </Card>
        </>
      ) : null}

      {clock.waiting ? null : (
        <p className="gr" style={{ fontSize: '12.5px', marginTop: 14 }}>
          Nothing is waiting on you. Corrections, overtime claims and shift swaps all arrive here when
          they are raised.
        </p>
      )}
    </>
  )
}

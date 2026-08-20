import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Assumption,
  Avatar,
  Btn,
  Card,
  Chip,
  Empty,
  Kpi,
  Kpis,
  Label,
  PageHead,
  SectionHead,
  Tabs,
} from '@/components/ui'
import { RequireCap } from '@/components/RequireCap'
import { useUi } from '@/state/ui'
import { useTimeclock } from '@/state/timeclock'
import { ATT, LEAVE, PAYMONTHS, TIMECFG } from '@/data/hrms'
import { AVAIL, HOLIDAYS, SITES, STAFF } from '@/data/people'
import { absencePattern } from '@/lib/attendance'
import { hm, shiftOf, worked } from '@/lib/timeclock'
import { whoName } from '@/lib/permissions'
import { fmtDate, initials, pad } from '@/lib/format'
import { now } from '@/lib/clock'
import { csvName, downloadCSV } from '@/lib/csv'
import type { Person } from '@/data/types'

/**
 * Attendance and time.
 *
 * Five different things happen here, and stacking them made one very long page
 * that hid the two needing action. One tab each, with anything waiting counted on
 * the tab itself, so the queue announces itself without being scrolled to.
 */

type Tab = 'Today' | 'Roster' | 'This month' | 'Late logins' | 'Patterns' | 'How it works'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Three or more in the range is a pattern rather than a coincidence. */
const REPEAT_AT = 3

const rostered = () => STAFF.filter((p) => p.dep.length && p.active !== false)

const onLeaveOn = (id: string, d: Date) =>
  LEAVE.some((l) => l.who === id && l.st === 'approved' && l.from <= d && l.to >= d)

function Attendance() {
  const navigate = useNavigate()
  const { toast } = useUi()
  const clock = useTimeclock()

  const [tab, setTab] = useState<Tab>('Today')
  const [month, setMonth] = useState(PAYMONTHS[PAYMONTHS.length - 1])
  const [lateFilter, setLateFilter] = useState('all')

  const list = rostered()
  const roll = ATT[month] ?? {}
  const today = now()

  const openPerson = (id: string) => navigate({ to: '/staff/$personId', params: { personId: id } })

  const pendingCorrections = clock.corrections.filter((r) => r.st === 'pending')
  const pendingOt = clock.overtime.filter((o) => o.st === 'pending')
  const pendingSwaps = clock.swaps.filter((s) => s.st === 'pending')
  const openLate = clock.late.filter((x) => !x.waived)

  const inNow = list.filter((p) => {
    const m = clock.markOf(p.id)
    return m && m.in && !m.out
  }).length
  const awayToday = list.filter((p) => onLeaveOn(p.id, today)).length

  const TABS: [Tab, number | null][] = [
    ['Today', clock.waiting || null],
    ['Roster', null],
    ['This month', null],
    ['Late logins', openLate.length || null],
    ['Patterns', null],
    ['How it works', null],
  ]

  const sub =
    tab === 'Today'
      ? `${fmtDate(today)} · ${inNow} of ${list.length} working right now`
      : tab === 'This month'
        ? `${month} · ${list.length} people`
        : tab === 'Roster'
          ? 'The next seven days, with holidays, leave and swaps already in it'
          : tab === 'Late logins'
            ? `Last 30 days · ${TIMECFG.lateGraceMins} minutes of grace before a punch counts as late`
            : tab === 'Patterns'
              ? 'Absence worth a conversation, rather than absence in total'
              : 'Sites, shifts, and the rules a day is judged against'

  const exportMonth = () => {
    const out = downloadCSV(csvName(`attendance-${month.replace(' ', '-')}`), [
      ['Employee', 'Department', 'Days in month', 'Working days', 'Present', 'Paid leave', 'Unpaid'],
      ...list.map((p) => {
        const x = roll[p.id]
        return [p.n, p.dep[0] ?? '', x?.days, x?.working, x?.present, x?.paidLeave, x?.lop]
      }),
    ])
    toast(`${out.name} — ${out.rows.length - 1} people`)
  }

  const exportLate = () => {
    const out = downloadCSV(csvName('late-logins'), [
      ['Date', 'Who', 'Shift', 'Due in', 'Punched', 'Late by (min)', 'Reason', 'Waived'],
      ...clock.late.map((x) => [
        x.dk,
        whoName(x.who),
        x.shift,
        x.due,
        x.at,
        x.mins,
        x.why ?? '',
        x.waived ? 'yes' : '',
      ]),
    ])
    toast(`${out.name} — ${out.rows.length - 1} marks`)
  }

  /** What today looks like for one person, in a phrase and a chip colour. */
  const stateOf = (p: Person): [string, 'v' | 'b' | 'r' | 'n'] => {
    const m = clock.markOf(p.id)
    if (onLeaveOn(p.id, today)) return ['On leave', 'r']
    if (m && m.in && !m.out) return [`In — since ${m.in}`, 'v']
    if (m && m.out) return [`Done — ${hm(worked(m))}`, 'b']
    if (p.avail !== 'ok') return [AVAIL[p.avail][0], 'n']
    return ['Not marked', 'n']
  }

  return (
    <>
      <PageHead
        title="Attendance and time"
        sub={sub}
        actions={
          tab === 'This month' ? (
            <Btn variant="ghost" onClick={exportMonth}>
              Export
            </Btn>
          ) : tab === 'Late logins' ? (
            <Btn variant="ghost" onClick={exportLate}>
              Export
            </Btn>
          ) : undefined
        }
      />

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'Today' ? (
        <TodayTab
          list={list}
          inNow={inNow}
          awayToday={awayToday}
          stateOf={stateOf}
          openPerson={openPerson}
          onTab={setTab}
        />
      ) : null}

      {tab === 'Roster' ? <RosterTab list={list} /> : null}

      {tab === 'This month' ? (
        <MonthTab list={list} month={month} onMonth={setMonth} openPerson={openPerson} />
      ) : null}

      {tab === 'Late logins' ? (
        <LateTab list={list} filter={lateFilter} onFilter={setLateFilter} openPerson={openPerson} />
      ) : null}

      {tab === 'Patterns' ? <PatternsTab list={list} openPerson={openPerson} /> : null}

      {tab === 'How it works' ? <HowTab /> : null}
    </>
  )

  /* ── Today ───────────────────────────────────────────────────────────── */

  function TodayTab({
    list,
    inNow,
    awayToday,
    stateOf,
    openPerson,
  }: {
    list: Person[]
    inNow: number
    awayToday: number
    stateOf: (p: Person) => [string, 'v' | 'b' | 'r' | 'n']
    openPerson: (id: string) => void
    onTab: (t: Tab) => void
  }) {
    /* Grouped by department because that is the unit that has to be covered — a
       department showing nobody in is the one to act on before the queue backs up. */
    const groups = new Map<string, Person[]>()
    list.forEach((p) => {
      const d = p.dep[0] ?? '—'
      groups.set(d, [...(groups.get(d) ?? []), p])
    })

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
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto' }}>
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
              <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
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
              </div>
            </Card>
          </>
        ) : null}

        {pendingOt.length ? (
          <>
            <SectionHead>Overtime to approve — {pendingOt.length}</SectionHead>
            <Card>
              <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
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
              </div>
            </Card>
          </>
        ) : null}

        {pendingSwaps.length ? (
          <>
            <SectionHead>Shift swaps — {pendingSwaps.length}</SectionHead>
            <Card>
              <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
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
              </div>
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

  /* ── Roster ──────────────────────────────────────────────────────────── */

  function RosterTab({ list }: { list: Person[] }) {
    const days = [...Array(7)].map(
      (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i),
    )
    const holidayOn = (d: Date) => HOLIDAYS.find((h) => h.d === fmtDate(d))
    const swapOn = (p: Person, d: Date) =>
      clock.swaps.find((x) => x.st === 'approved' && x.d === fmtDate(d) && (x.from === p.id || x.to === p.id))

    return (
      <>
        <Card>
          <div className="tsc">
            <table className="mat" style={{ minWidth: 220 + 7 * 104 }}>
              <thead>
                <tr>
                  <th style={{ minWidth: 190 }}>Who</th>
                  {days.map((d) => {
                    const h = holidayOn(d)
                    return (
                      <th key={d.toDateString()} style={{ textAlign: 'center', minWidth: 96 }}>
                        {DAY_NAMES[d.getDay()]}
                        <div className="gr" style={{ fontWeight: 400, fontSize: '11.5px' }}>
                          {pad(d.getDate())}/{pad(d.getMonth() + 1)}
                        </div>
                        {h ? (
                          <div className="chip n" style={{ fontSize: '10.5px', marginTop: 3 }}>
                            {h.n.split(' ')[0]}
                          </div>
                        ) : null}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {list.map((p) => {
                  const sh = shiftOf(p)
                  return (
                    <tr key={p.id}>
                      <td>
                        <b>{p.n}</b>
                        <div className="gr" style={{ fontSize: '11.5px' }}>
                          {sh.n} · {sh.from}–{sh.to}
                        </div>
                      </td>
                      {days.map((d) => {
                        const h = holidayOn(d)
                        const off = onLeaveOn(p.id, d)
                        const sw = swapOn(p, d)
                        const rest = d.getDay() === 0
                        return (
                          <td key={d.toDateString()} style={{ textAlign: 'center' }}>
                            {h && !h.opt ? (
                              <span className="chip n" style={{ fontSize: '10.5px' }}>
                                Holiday
                              </span>
                            ) : off ? (
                              <span className="chip r" style={{ fontSize: '10.5px' }}>
                                Leave
                              </span>
                            ) : rest ? (
                              <span className="gr" style={{ fontSize: '11.5px' }}>
                                rest
                              </span>
                            ) : sw ? (
                              <span className="chip b" style={{ fontSize: '10.5px' }}>
                                Swap
                              </span>
                            ) : (
                              <span className="mono gr" style={{ fontSize: '11.5px' }}>
                                {sh.from}
                              </span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
        <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
          Seven days ahead, with holidays, approved leave and agreed swaps already in it. This is the
          view a person checks before asking for a day — and the one a lead checks before approving one.
        </p>
      </>
    )
  }

  /* ── This month ──────────────────────────────────────────────────────── */

  function MonthTab({
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
                        <div className="v gr" style={{ fontSize: '12.5px' }}>
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
        <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
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
                          <div className="v mono" style={{ fontSize: '12.5px' }}>
                            {l.d}
                          </div>
                        </div>
                        <div className="cell">
                          <div className="v" style={{ fontSize: '12.5px' }}>
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
                          <div className={`v ${l.inside ? '' : 'warn'}`} style={{ fontSize: '12.5px' }}>
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
            <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
              Every punch is kept with where it was made. A correction cannot delete one — it adds an
              approved change on top, so the original is still there.
            </p>
          </>
        ) : null}
      </>
    )
  }

  /* ── Late logins ─────────────────────────────────────────────────────── */

  function LateTab({
    list,
    filter,
    onFilter,
    openPerson,
  }: {
    list: Person[]
    filter: string
    onFilter: (f: string) => void
    openPerson: (id: string) => void
  }) {
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
                            /* Read the intent before the write: `x` is the ledger's
                               own object, so `x.waived` has already flipped by the
                               time the toast is composed. */
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

  /* ── Patterns ────────────────────────────────────────────────────────── */

  function PatternsTab({ list, openPerson }: { list: Person[]; openPerson: (id: string) => void }) {
    const flagged = list.map((p) => ({ p, a: absencePattern(p.id) })).filter((x) => x.a.flags.length)

    if (!flagged.length) {
      return (
        <Card padded>
          <p className="gr" style={{ fontSize: '13.5px', margin: 0 }}>
            No patterns worth raising. Absence is spread the way you would expect it to be.
          </p>
        </Card>
      )
    }

    return (
      <>
        <Card>
          <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
            {flagged.map(({ p, a }) => (
              <div className="rw" key={p.id}>
                <span className="warn" style={{ fontSize: '14.5px' }}>
                  ◷
                </span>
                <span>
                  <b>{p.n}</b>{' '}
                  <span className="gr">
                    · {a.total} days taken, {a.lop} unpaid
                  </span>
                  {a.flags.map(([head, why]) => (
                    <div className="sd" key={head} style={{ marginTop: 4 }}>
                      <b>{head}</b> — {why}
                    </div>
                  ))}
                </span>
                <span>
                  <Btn variant="ghost" small onClick={() => openPerson(p.id)}>
                    Their record
                  </Btn>
                </span>
              </div>
            ))}
          </div>
        </Card>
        <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
          Patterns, not totals. Somebody who took three weeks in one go does not appear here; somebody
          who takes every third Monday does. The second is the one a manager can actually help with.
        </p>
      </>
    )
  }

  /* ── How it works ────────────────────────────────────────────────────── */

  function HowTab() {
    return (
      <div className="two">
        <Card padded>
          <Label>Sites and the geofence</Label>
          {SITES.map((x) => (
            <div
              key={x.k}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '8px 0',
                fontSize: '13.5px',
                borderBottom: '1px solid var(--hair)',
              }}
            >
              <span>
                <b>{x.n}</b>
                <div className="gr" style={{ fontSize: '11.5px' }}>
                  {x.lat}, {x.lng}
                </div>
              </span>
              <b className="mono">{x.radius} m</b>
            </div>
          ))}
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
            A check-in outside every radius is still recorded — it is marked as away from site rather
            than refused. Refusing it would mean someone at a courthouse cannot start their day.
          </p>
        </Card>
        <Card padded>
          <Label>Face recognition</Label>
          <Assumption title="Not built, and not something to fake">
            A browser can ask where a device is, and that is real above. It cannot tell you{' '}
            <b>whose face</b> this is without a camera, a model and somewhere to keep a biometric
            template. Biometrics are also a different legal category from a punch time — under India’s
            data protection law they need explicit consent, a stated purpose and a retention limit.{' '}
            <b>This is worth building properly with someone who knows that Act, or buying from a vendor
            who has.</b> A mock here would suggest a control that does not exist.
          </Assumption>
          <p className="gr" style={{ fontSize: '12.5px' }}>
            What the geofence does give you: the check-in records the device location and its accuracy,
            and flags anything outside the site radius.
          </p>
        </Card>
      </div>
    )
  }
}

export default function AttendanceRoute() {
  return (
    <RequireCap cap="all">
      <Attendance />
    </RequireCap>
  )
}

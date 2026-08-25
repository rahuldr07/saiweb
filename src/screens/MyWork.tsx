import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  Banner,
  Bar,
  Btn,
  Card,
  Chip,
  Due,
  Kpi,
  Kpis,
  Label,
  PageHead,
  Row,
  Rows,
  SectionHead,
  focusSection,
} from '@/components/ui'
import { SkeletonRows } from '@/components/async'
import { TeamWishes, YourWish } from '@/components/Wishes'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { useTimeclock } from '@/state/timeclock'
import { UpdateForm } from './mywork/UpdateForm'
import { SwapForm } from './mywork/SwapForm'
import { OvertimeForm } from './mywork/OvertimeForm'
import { postUpdate, useUpdates } from './mywork/updates'
import { STAFF, HOLIDAYS } from '@/data/people'
import { UPDKIND } from '@/data/production'
import { ATT, LEAVETYPES, PAYMONTHS } from '@/data/hrms'
import { board } from '@/lib/engine'
import { dueOf, orderPlan } from '@/lib/sla'
import { leaveBalance } from '@/lib/payroll'
import { useQcRules } from '@/state/qcRules'
import { DEFAULT_RANGE, inRange, resolveRange } from '@/lib/range'
import { useQcLog } from '@/lib/useQcLog'
import { hhmm, hm, restCheck, shiftOf, worked } from '@/lib/timeclock'
import { whoName } from '@/lib/permissions'
import { celebrationsWithin } from '@/lib/celebrations'
import { fmtDT, fmtDate, parseUsDate } from '@/lib/format'
import { now } from '@/lib/clock'
import type { Update } from '@/data/types'

const QCOLS = '150px 150px 140px 1fr 150px 110px'

const greeting = (h: number) => (h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening')

/** The month payroll is currently working on. */
const payMonth = () => PAYMONTHS[PAYMONTHS.length - 1]

/**
 * My work — the screen production staff live in.
 *
 * It answers four questions in the order a day asks them: am I marked in, what
 * is on my desk, where does my month stand, and what did the rest of my
 * department say. Nothing on it compares anyone to a colleague: the target is
 * their own, the checkpoints are their department's slice of the promise, and
 * the quality panel shows only their own ratings — and only if the company has
 * left that setting on.
 */
export default function MyWork() {
  const { me } = useSession()
  const { openModal, closeModal, toast } = useUi()
  const clock = useTimeclock()
  const navigate = useNavigate()
  const qcLog = useQcLog()
  const updates = useUpdates()
  const [showAllDone, setShowAllDone] = useState(false)

  const { run, work: allWork, dwork } = board()
  const wk = allWork[me.id] ?? { done: 0, pend: 0, tot: 0, pct: 0, items: [], stages: {} }
  const mine = [...wk.items].sort((a, b) => a.hr - b.hr)
  const open = mine.filter((i) => !i.fin)
  const finished = mine.filter((i) => i.fin)
  const risky = open.map((i) => ({ i, p: orderPlan(i.o) })).filter((x) => x.p.doomed || x.p.behind)

  const range = resolveRange(DEFAULT_RANGE)
  const rated = (qcLog.data ?? []).filter((x) => x.onName === me.n && inRange(x.d, range))
  const showScores = useQcRules().find((r) => r.k === 'see')?.on ?? false
  const qavg = rated.length ? rated.reduce((a, x) => a + x.avg, 0) / rated.length : null

  const shift = shiftOf(me)
  const mark = clock.markOf(me.id)
  const rest = restCheck(mark, hhmm(now()))
  const roomLeft = Math.max(0, me.cap - (run.load[me.id] ?? 0))

  const month = payMonth()
  const att = ATT[month]?.[me.id] ?? { present: 0, working: 0, paidLeave: 0, lop: 0, hol: 0 }
  const balances = leaveBalance(me.id)
  const nextHoliday = HOLIDAYS.map((h) => ({ h, dt: parseUsDate(h.d) }))
    .filter((x) => x.dt >= now())
    .sort((a, b) => +a.dt - +b.dt)[0]

  /* Birthdays and anniversaries in the week ahead. Derived from the roster, so
     nothing has to be entered for one to appear. Rendered only when there is
     something — an empty "no birthdays" panel every day is clutter. */
  const wishes = celebrationsWithin(STAFF, now(), 7)
  const yours = wishes.filter((c) => c.person.id === me.id && c.inDays === 0)
  const theirs = wishes.filter((c) => c.person.id !== me.id)

  const myUpdates = updates.filter((u) => u.who === me.id).slice(0, 4)
  const teamUpdates = updates
    .filter(
      (u) =>
        u.who !== me.id &&
        (STAFF.find((x) => x.id === u.who)?.dep ?? []).some((d) => me.dep.includes(d)),
    )
    .slice(0, 4)

  /* ── the clock ─────────────────────────────────────────────────────────── */

  const workedToday = mark?.out ? worked(mark) - (mark.breakMins ?? 0) : 0

  const askSwap = () => {
    const peers = STAFF.filter(
      (x) => x.id !== me.id && x.active !== false && x.dep.some((d) => me.dep.includes(d)),
    )
    if (!peers.length) return toast('Nobody else is in your department to swap with')
    openModal({
      title: 'Ask someone to take a shift',
      body: (
        <SwapForm
          peers={peers}
          onCancel={closeModal}
          onSubmit={(to, date, why) => {
            clock.requestSwap(me.id, to, date, why)
            closeModal()
            toast('Sent to your manager')
          }}
        />
      ),
    })
  }

  const raiseOvertime = () =>
    openModal({
      title: 'Claim overtime',
      body: (
        <OvertimeForm
          workedMins={workedToday}
          onCancel={closeModal}
          onSubmit={(date, minutes, why) => {
            clock.claimOvertime(me.id, date, minutes, why)
            closeModal()
            toast('Sent for approval')
          }}
        />
      ),
    })

  const addUpdate = () =>
    openModal({
      title: 'Add an update',
      body: (
        <UpdateForm
          onCancel={closeModal}
          onSubmit={(kind, body) => {
            postUpdate(me.id, kind, body)
            closeModal()
            toast('Posted')
          }}
        />
      ),
    })

  /* ── the modals behind the figures ─────────────────────────────────────── */

  const note = (children: React.ReactNode) => (
    <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
      {children}
    </p>
  )

  const myDone = () =>
    openModal({
      title: `Finished today — ${finished.length}`,
      body: (
        <>
          {finished.length ? (
            <Rows>
              {finished.map((x, i) => (
                <Row
                  key={`${x.o.id}-${x.stage}-${i}`}
                  icon={<span className="ok">✓</span>}
                  title={`${x.o.id} · ${x.stage}`}
                  detail={`${x.o.cl} · ${x.o.pr}`}
                  right={<span className="mono gr">from {x.hr}:00</span>}
                />
              ))}
            </Rows>
          ) : (
            <p className="gr" style={{ fontSize: '13.5px', margin: 0 }}>
              Nothing finished yet today.
            </p>
          )}
          {note(
            `${wk.pct}% of what was placed with you. The rest is still on your desk rather than lost.`,
          )}
        </>
      ),
    })

  const myLate = () =>
    openModal({
      title: `Past a checkpoint — ${risky.length}`,
      body: (
        <>
          {risky.length ? (
            <Rows>
              {risky.map((x, i) => (
                <Row
                  key={`${x.i.o.id}-${x.i.stage}-${i}`}
                  icon={<span className={x.p.doomed ? 'bad' : 'gr'}>{x.p.doomed ? '⚑' : '◷'}</span>}
                  title={x.i.o.id}
                  detail={`${x.i.o.cl} · ${x.i.o.pr} · ${x.i.stage}${
                    x.p.short > 0 ? ` · short ${x.p.short}h` : ''
                  }`}
                  right={
                    <span className={x.p.doomed ? 'bad' : 'gr'}>
                      {x.p.doomed ? 'cannot land' : 'still recoverable'}
                    </span>
                  }
                />
              ))}
            </Rows>
          ) : (
            <p className="gr" style={{ fontSize: '13.5px', margin: 0 }}>
              Nothing on your desk is past a checkpoint.
            </p>
          )}
          {note(
            <>
              These are <b>internal</b> checkpoints, not the client promise. Being past one is a
              warning while there is still time to act — which is the whole point of having them.
            </>,
          )}
        </>
      ),
      footer: (
        <>
          <Btn
            variant="ghost"
            onClick={() => {
              closeModal()
              focusSection('mwQueue')
            }}
          >
            Your queue
          </Btn>
          <Btn onClick={closeModal}>Close</Btn>
        </>
      ),
    })

  const myCapacity = () => {
    const used = run.load[me.id] ?? 0
    openModal({
      title: 'How your day is sized',
      body: (
        <>
          <Rows>
            <Row
              title="Your target"
              detail={`set on your record — ${me.dep.join(', ') || 'no department'}`}
              right={<span className="mono">{me.cap} stages</span>}
            />
            <Row
              title="Given to you today"
              detail="by the assignment run"
              right={<span className="mono">{used}</span>}
            />
            <Row
              title="Room left"
              detail="what the run will still place with you"
              right={
                <span className={`mono ${used >= me.cap ? 'bad' : 'ok'}`}>
                  {Math.max(0, me.cap - used)}
                </span>
              }
            />
          </Rows>
          {note(
            'The target is a limit the assignment run respects, not a quota you are measured against. When everyone is full, work waits as an exception rather than being pushed onto someone who cannot take it.',
          )}
        </>
      ),
    })
  }

  /* ── the clock card's buttons ──────────────────────────────────────────── */

  const clockActions = !mark ? (
    <Btn onClick={() => clock.checkIn(me.id, toast)}>Check in</Btn>
  ) : !mark.out ? (
    <>
      {mark.breakIn && !mark.breakOut ? (
        <Btn onClick={() => toast(clock.breakEnd(me.id))}>End break</Btn>
      ) : (
        <Btn variant="ghost" onClick={() => toast(clock.breakStart(me.id))}>
          Start break
        </Btn>
      )}
      <Btn onClick={() => clock.checkOut(me.id, toast)}>Check out</Btn>
    </>
  ) : (
    <>
      <Chip kind="v">Day complete</Chip>
      <Btn variant="ghost" onClick={raiseOvertime}>
        Claim overtime
      </Btn>
    </>
  )

  const updateRow = (u: Update, withName: boolean) => (
    <div className="rw tagged" key={u.id}>
      <span>
        <Chip kind={UPDKIND[u.kind] ?? 'n'}>{u.kind}</Chip>
      </span>
      <span>
        {withName ? <b style={{ fontSize: '13.5px' }}>{whoName(u.who)}</b> : null}
        <div className="sd">{u.b}</div>
        <div className="sd gr">{fmtDate(u.d)}</div>
      </span>
      <span />
    </div>
  )

  return (
    <>
      <PageHead
        title={`Good ${greeting(now().getHours())}, ${me.n.split(' ')[0]}`}
        sub={`${me.dep.join(' · ') || 'No department'} · target ${me.cap} a day`}
        actions={
          <Btn
            variant="ghost"
            onClick={() => navigate({ to: '/staff/$personId', params: { personId: me.id } })}
          >
            My profile
          </Btn>
        }
      />

      <YourWish celebrations={yours} firstName={me.n.split(' ')[0]} />

      {/* ── today's clock ── */}
      <Card padded style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Label>Today — {fmtDate(now())}</Label>
            <div style={{ fontSize: '13.5px', marginTop: 6 }}>
              <Chip kind={shift.c}>{shift.n}</Chip>{' '}
              <span className="gr">
                {shift.from} to {shift.to}
              </span>
            </div>
            {mark ? (
              <>
                <div className="gr" style={{ fontSize: '12.5px', marginTop: 7 }}>
                  In at <b className="mono">{mark.in}</b>
                  {mark.out ? (
                    <>
                      {' · out at '}
                      <b className="mono">{mark.out}</b> · <b>{hm(worked(mark))}</b>
                    </>
                  ) : (
                    ' · still working'
                  )}
                  {mark.late ? <span className="warn"> · {mark.late} minutes late</span> : null}
                </div>
                <div className="gr" style={{ fontSize: '11.5px', marginTop: 3 }}>
                  {mark.inside ? <span className="ok">✓</span> : <span className="warn">◷</span>}{' '}
                  {mark.where}
                  {mark.acc ? ` · accurate to ${mark.acc} m` : ''}
                </div>
              </>
            ) : (
              <div className="gr" style={{ fontSize: '12.5px', marginTop: 7 }}>
                Not marked yet. Checking in asks the browser where you are.
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', alignItems: 'center' }}>
            {clockActions}
            <Btn variant="ghost" onClick={askSwap}>
              Swap a shift
            </Btn>
            <Btn variant="ghost" onClick={() => navigate({ to: '/leave' })}>
              Leave
            </Btn>
          </div>
        </div>

        {rest ? (
          <div
            className="rw"
            style={{
              background: rest.ok ? 'var(--oktint)' : 'var(--warntint)',
              borderRadius: 9,
              padding: '11px 13px',
              marginTop: 12,
            }}
          >
            <span className={rest.ok ? 'ok' : 'warn'} style={{ fontSize: '14.5px' }}>
              {rest.ok ? '✓' : '◷'}
            </span>
            <span>
              <b>{rest.ok ? 'Rest break taken' : 'No rest break yet'}</b>
              <div className="sd">{rest.msg}</div>
            </span>
            <span />
          </div>
        ) : null}

        {mark?.breakMins ? (
          <div className="gr" style={{ fontSize: '11.5px', marginTop: 8 }}>
            Break: {mark.breakMins} minutes
            {mark.breakIn && !mark.breakOut ? ' — on a break now' : ''}
          </div>
        ) : null}
      </Card>

      {/* ── the four figures ── */}
      <Kpis>
        <Kpi
          title="On your desk"
          value={<span className={open.length ? 'warn' : 'ok'}>{open.length}</span>}
          tone={open.length ? 'warn' : undefined}
          detail={open.length ? 'still to finish' : 'nothing outstanding'}
          hint="Your queue"
          onClick={() => focusSection('mwQueue')}
        />
        <Kpi
          title="Finished today"
          value={<span className="ok">{wk.done}</span>}
          detail={`${wk.pct}% of what you were given`}
          hint="What you finished"
          onClick={myDone}
        />
        <Kpi
          title="Running late"
          value={<span className={risky.length ? 'bad' : 'ok'}>{risky.length}</span>}
          tone={risky.length ? 'alert' : undefined}
          detail="past an internal checkpoint"
          hint="Which ones, and by how much"
          onClick={myLate}
        />
        <Kpi
          title="Room left today"
          value={roomLeft}
          detail={`of a ${me.cap} target`}
          hint="How the target is set"
          onClick={myCapacity}
        />
      </Kpis>

      {/* ── the month, and leave ── */}
      <div className="two" style={{ marginTop: 16 }}>
        <Card padded>
          <Label>Your {month}</Label>
          {(
            [
              ['Days present', `${att.present} of ${att.working}`],
              ['Paid leave taken', att.paidLeave],
              ['Unpaid days', att.lop],
              ['Holidays in the month', att.hol],
            ] as [string, string | number][]
          ).map((r) => (
            <div
              key={r[0]}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '7px 0',
                fontSize: '13.5px',
                borderBottom: '1px solid var(--hair)',
              }}
            >
              <span className="gr">{r[0]}</span>
              <b className="mono">{r[1]}</b>
            </div>
          ))}
          {nextHoliday ? (
            <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
              Next holiday: <b>{nextHoliday.h.n}</b> on {nextHoliday.h.d}
              {nextHoliday.h.opt ? ' — optional' : ''}.
            </p>
          ) : null}
        </Card>

        <Card padded>
          <Label>Leave you have left</Label>
          {LEAVETYPES.filter((t) => t.annual > 0).map((t) => {
            const b = balances[t.k]
            return (
              <div
                key={t.k}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '130px 1fr 78px',
                  gap: 11,
                  alignItems: 'center',
                  padding: '6px 0',
                  fontSize: '13.5px',
                }}
              >
                <span>
                  <Chip kind={t.c}>{t.n}</Chip>
                </span>
                <Bar value={b.left} max={Math.max(1, b.earned)} color="var(--brand2)" />
                <span className="mono" style={{ textAlign: 'right' }}>
                  {b.left} of {b.earned}
                </span>
              </div>
            )
          })}
          <div style={{ marginTop: 12 }}>
            <Btn variant="ghost" small onClick={() => navigate({ to: '/leave' })}>
              Apply for leave
            </Btn>
          </div>
        </Card>

        {theirs.length ? (
          <TeamWishes celebrations={theirs} title="Around the team" />
        ) : null}
      </div>

      {risky.length ? (
        <Banner
          kind="d"
          icon="⚑"
          style={{ marginTop: 16 }}
          title={`${risky.length} of yours ${risky.length === 1 ? 'is' : 'are'} behind where they should be`}
        >
          These are at the top of the list.{' '}
          {risky.some((x) => x.p.doomed)
            ? 'One or more cannot be finished in time — tell whoever runs your department now, not at five o’clock.'
            : 'Still recoverable, but the slack is going.'}
        </Banner>
      ) : null}

      {/* ── the shift log ── */}
      <div className="two" style={{ marginTop: 18 }}>
        <Card padded>
          {/* The card is already padded, so its head loses the rule and the
              inset the standalone `CardHead` carries. */}
          <div className="ch" style={{ border: 'none', padding: '0 0 10px' }}>
            <Label>What you wrote</Label>
            <div className="r">
              <Btn small onClick={addUpdate}>
                ＋ Add an update
              </Btn>
            </div>
          </div>
          {myUpdates.length ? (
            <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
              {myUpdates.map((u) => updateRow(u, false))}
            </div>
          ) : (
            <p className="gr" style={{ fontSize: '13.5px', margin: 0 }}>
              Nothing yet. A handover note written today is the thing that saves someone an hour
              tomorrow.
            </p>
          )}
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            Updates cannot be edited once posted. That is what makes them worth reading back.
          </p>
        </Card>

        <Card padded>
          <Label>From your department</Label>
          {teamUpdates.length ? (
            <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
              {teamUpdates.map((u) => updateRow(u, true))}
            </div>
          ) : (
            <p className="gr" style={{ fontSize: '13.5px', margin: 0 }}>
              Nothing from the rest of {me.dep[0] || 'your department'} recently.
            </p>
          )}
        </Card>
      </div>

      {/* ── the queue ── */}
      <SectionHead id="mwQueue">
        {open.length ? `Your queue — ${open.length} to do` : 'Your queue is clear'}
      </SectionHead>

      {open.length ? (
        <>
          <Card>
            <div className="tsc">
              <div style={{ minWidth: 880 }}>
                <div className="trow h" style={{ gridTemplateColumns: QCOLS }}>
                  <span>Order</span>
                  <span>Client</span>
                  <span>Your stage</span>
                  <span>Property</span>
                  <span>Due</span>
                  <span />
                </div>
                <div className="tb">
                  {open.map(({ o, stage, hr }, i) => {
                    const plan = orderPlan(o)
                    const cp = plan.rows.find((r) => r.stage === stage)
                    const openOrder = () =>
                      navigate({ to: '/orders/$orderId', params: { orderId: o.id } })
                    return (
                      <div
                        key={`${o.id}-${stage}-${i}`}
                        className="trow"
                        role="button"
                        tabIndex={0}
                        style={{ gridTemplateColumns: QCOLS, cursor: 'pointer' }}
                        onClick={openOrder}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            openOrder()
                          }
                        }}
                      >
                        <div className="cell">
                          <div className="v mono">{o.id}</div>
                          <div className="s">arrived {hr}:00</div>
                        </div>
                        <div className="cell">
                          <div className="v">{o.cl}</div>
                          <div className="s">{o.pr}</div>
                        </div>
                        <div className="cell">
                          <div className="v">{stage}</div>
                          {cp?.behind ? (
                            <div className="s bad">past your checkpoint</div>
                          ) : cp ? (
                            <div className="s gr">by {fmtDT(cp.at)}</div>
                          ) : null}
                        </div>
                        <div className="cell">
                          {/* An arrival carries where the property is but not its
                              address — that is taken at intake. The design prints
                              an em-dash above the county for every row; the county
                              on its own says the same thing without the dash
                              claiming something is missing that was never asked
                              for. */}
                          <div className="v" style={{ fontSize: '12.5px' }}>
                            {o.co ? `${o.co}, ${o.st}` : '—'}
                          </div>
                        </div>
                        <div className="cell">
                          <Due at={dueOf(o)} />
                        </div>
                        <div className="cell">
                          <Btn
                            variant="ghost"
                            small
                            onClick={(e) => {
                              e.stopPropagation()
                              openOrder()
                            }}
                          >
                            Open
                          </Btn>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </Card>
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
            Ordered by when it arrived. Your checkpoint is your department’s slice of the client’s
            promise — not the client deadline itself, which is later.
          </p>
        </>
      ) : (
        <Card padded>
          <p className="gr" style={{ fontSize: '12.5px', margin: 0 }}>
            Everything assigned to you today is done. {wk.done} stage{wk.done === 1 ? '' : 's'}{' '}
            finished.
          </p>
        </Card>
      )}

      {/* ── finished ── */}
      {wk.done ? (
        <>
          <SectionHead id="mwDone">Finished today — {wk.done}</SectionHead>
          <Card>
            <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
              {(showAllDone ? finished : finished.slice(0, 8)).map((i, idx) => (
                <div className="rw" key={`${i.o.id}-${i.stage}-${idx}`}>
                  <span className="ok">✓</span>
                  <span>
                    <b className="mono" style={{ fontSize: '12.5px' }}>
                      {i.o.id}
                    </b>{' '}
                    <span className="gr">{i.stage}</span>
                    <div className="sd gr">
                      {i.o.cl} · {i.o.pr}
                    </div>
                  </span>
                  <span className="gr mono" style={{ fontSize: '11.5px' }}>
                    {i.hr}:00
                  </span>
                </div>
              ))}
              {finished.length > 8 && !showAllDone ? (
                <div className="rw">
                  <span className="gr">·</span>
                  <span className="gr" style={{ fontSize: '12.5px' }}>
                    and {finished.length - 8} more
                  </span>
                  <span>
                    <Btn variant="ghost" small onClick={() => setShowAllDone(true)}>
                      Show all
                    </Btn>
                  </span>
                </div>
              ) : null}
            </div>
          </Card>
        </>
      ) : null}

      {/* ── quality, and where you fit ── */}
      <div className="two" style={{ marginTop: 18 }}>
        <Card padded>
          <Label>Your quality</Label>
          {!showScores ? (
            <>
              <p className="gr" style={{ fontSize: '12.5px', margin: 0 }}>
                Scores are not shown to the person rated on this account.
              </p>
              <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
                That is a company setting — <b>Quality → How scoring works → “Scores are visible to
                the person rated”</b>. It is off by default, on the view that ratings used for filing
                should not be read as a report card.
              </p>
            </>
          ) : qcLog.isPending ? (
            <SkeletonRows rows={3} cols={2} />
          ) : rated.length && qavg !== null ? (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '8px 0 10px' }}>
                <b className="mono" style={{ fontSize: '26px' }}>
                  {qavg.toFixed(2)}
                </b>
                <span className="gr">
                  from {rated.length} checks · {range.label}
                </span>
              </div>
              {rated.filter((x) => x.note).length ? (
                <div className="rows" style={{ border: 'none', borderRadius: 0 }}>
                  {rated
                    .filter((x) => x.note)
                    .slice(0, 4)
                    .map((x, i) => (
                      <div className="rw" key={`${x.order}-${i}`}>
                        <span className="warn">·</span>
                        <span>
                          <b style={{ fontSize: '12.5px' }}>{x.note}</b>
                          <div className="sd gr">
                            {x.crit} · {x.order} · {x.dk}
                          </div>
                        </span>
                        <span />
                      </div>
                    ))}
                </div>
              ) : (
                <p className="gr" style={{ fontSize: '12.5px', margin: 0 }}>
                  Nothing has been raised against your work in this range.
                </p>
              )}
              <Btn
                variant="ghost"
                small
                className="mwAll"
                onClick={() => navigate({ to: '/staff/$personId', params: { personId: me.id } })}
              >
                All of it
              </Btn>
            </>
          ) : (
            <p className="gr" style={{ fontSize: '12.5px', margin: 0 }}>
              Nothing of yours has been checked in this range.
            </p>
          )}
        </Card>

        <Card padded>
          <Label>Where you fit</Label>
          {me.dep.length ? (
            me.dep.map((d) => {
              const dept = dwork[d] ?? { tot: 0 }
              const st = wk.stages[d] ?? { done: 0, pend: 0 }
              return (
                <div
                  key={d}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '130px 1fr 110px',
                    gap: 12,
                    alignItems: 'center',
                    padding: '7px 0',
                    fontSize: '12.5px',
                  }}
                >
                  <span>
                    <b>{d}</b>
                  </span>
                  <Bar
                    value={st.done + st.pend}
                    max={Math.max(1, dept.tot)}
                    color="var(--brand2)"
                  />
                  <span className="mono gr" style={{ textAlign: 'right' }}>
                    {st.done + st.pend} of {dept.tot}
                  </span>
                </div>
              )
            })
          ) : (
            <p className="gr" style={{ fontSize: '12.5px', margin: 0 }}>
              You are not in a department, so nothing can be assigned to you.
            </p>
          )}
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            Your share of what your department handled today.
          </p>
        </Card>
      </div>
    </>
  )
}

import { useReducer, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Avatar, Btn, Card, Chip, Kpi, Kpis, Label, PageHead, Seg } from '@/components/ui'
import { useSession } from '@/state/session'
import { useUi } from '@/state/ui'
import { LEAVE, LEAVEPOLICY, LEAVETYPES, LVSTATUS } from '@/data/hrms'
import { STAFF } from '@/data/people'
import { leaveBalance } from '@/lib/payroll'
import { CLASHRULES, approvesFor, leaveCheck, managerOf } from '@/lib/leave'
import { whoName } from '@/lib/permissions'
import { fmtDate } from '@/lib/format'
import { now } from '@/lib/clock'
import { ApplyLeave } from './leave/RequestLeave'
import { LeavePolicy } from './leave/LeavePolicy'
import type { Leave } from '@/data/types'

/**
 * Leave.
 *
 * Balances are earned minus taken, computed from the requests below rather than
 * stored — so a request and a balance cannot drift apart, and changing a quota
 * moves everyone's balance at once.
 *
 * Which screen you get depends on what you can see. Somebody without "all" sees
 * their own requests and their own balances; an approver sees the company's, with
 * the ones that are actually theirs to decide called out — the rest belong to
 * another approver and are shown for context, not for action.
 */

const COLS = '170px 140px 190px 70px 1fr 170px'

/** How many rows before the table stops and says how many there were. */
const PAGE = 40

const r2 = (n: number) => Math.round(n * 100) / 100

function LeaveScreen() {
  const navigate = useNavigate()
  const { me, can } = useSession()
  const { toast, openModal, closeModal } = useUi()

  const [, changed] = useReducer((n: number) => n + 1, 0)
  const [filter, setFilter] = useState('pending')
  const [sub, setSub] = useState<'Requests' | 'Policy'>('Requests')

  /* "Mine" is not a preference — it is what someone who cannot see every order
     is entitled to see, so the whole screen reshapes around it. */
  const mine = !can('all')
  const scope = mine ? LEAVE.filter((l) => l.who === me.id) : LEAVE
  const rows = filter === 'all' ? scope : scope.filter((l) => l.st === filter)

  const balance = leaveBalance(me.id)
  const manager = managerOf(me)
  const reportsToMe = approvesFor(me.id)
  const waitingOnMe = LEAVE.filter((l) => l.st === 'pending' && reportsToMe.some((x) => x.id === l.who))
  const pendingAll = LEAVE.filter((l) => l.st === 'pending')

  const decide = (id: string, st: 'approved' | 'rejected') => {
    const l = LEAVE.find((x) => x.id === id)
    if (!l) return
    l.st = st
    l.by = me.n
    l.at = now()
    changed()
    toast(`${whoName(l.who)} — ${st === 'approved' ? 'approved' : 'declined'}`)
  }

  /**
   * Cancelling.
   *
   * Leave that has already started is refused here on purpose: cancelling it
   * would rewrite attendance already counted, and possibly a payslip already
   * issued. That belongs in an attendance correction, where it is recorded.
   */
  const cancel = (l: Leave) => {
    const started = l.from < now()
    const type = LEAVETYPES.find((t) => t.k === l.type)
    openModal({
      title: started ? 'That leave has already started' : 'Cancel this leave?',
      body: started ? (
        <>
          <p style={{ fontSize: '13.5px' }}>
            It began on {fmtDate(l.from)}. Cancelling it now would rewrite attendance that has already
            been counted, and possibly a payslip that has already gone out.
          </p>
          <p className="gr" style={{ fontSize: '12.5px' }}>
            Raise it as an attendance correction instead, so the change is recorded rather than silently
            applied.
          </p>
        </>
      ) : (
        <>
          <p style={{ fontSize: '13.5px' }}>
            {l.days} day{l.days === 1 ? '' : 's'} of {type?.n ?? l.type} from {fmtDate(l.from)}.
          </p>
          <p className="gr" style={{ fontSize: '12.5px' }}>
            The balance goes straight back. Whoever approved it is not told automatically — worth a word
            if it was hard to arrange cover.
          </p>
        </>
      ),
      footer: started ? (
        <>
          <Btn variant="ghost" onClick={closeModal}>
            Close
          </Btn>
          <Btn
            onClick={() => {
              closeModal()
              navigate({ to: '/attend' })
            }}
          >
            Attendance
          </Btn>
        </>
      ) : (
        <>
          <Btn variant="ghost" onClick={closeModal}>
            Keep it
          </Btn>
          <Btn
            onClick={() => {
              l.st = 'cancelled'
              closeModal()
              changed()
              toast('Cancelled — balance restored')
            }}
          >
            Cancel the leave
          </Btn>
        </>
      ),
    })
  }

  const apply = () =>
    openModal({
      title: 'Apply for leave',
      body: (
        <ApplyLeave
          personId={me.id}
          onSent={(msg) => {
            closeModal()
            changed()
            toast(msg)
          }}
          onCancel={closeModal}
        />
      ),
    })

  const subSwitch = can('people') ? (
    <Seg
      options={[
        ['Requests', 'Requests'],
        ['Policy', 'Policy'],
      ]}
      value={sub}
      onChange={setSub}
    />
  ) : null

  if (sub === 'Policy') {
    return (
      <>
        <PageHead
          title="Leave"
          sub={`The rules every request is judged against · ${LEAVETYPES.length} types`}
          actions={subSwitch}
        />
        <LeavePolicy onChanged={changed} />
      </>
    )
  }

  /* Requests that would take a department below cover — before a decision, and
     after one. The second group is the one worth arranging cover for now. */
  const risky = LEAVE.filter((l) => l.st === 'pending' && l.clash)
  const approvedSoon = LEAVE.filter((l) => l.st === 'approved' && l.from > now())
    .map((l) => ({ l, c: leaveCheck(l.who, l.type, l.days, l.from, l.to).cover }))
    .filter((x) => x.c && x.c.left < LEAVEPOLICY.minCover)

  const filters: [string, string][] = [
    ['pending', 'Waiting'],
    ['approved', 'Approved'],
    ['rejected', 'Declined'],
    ['all', 'All'],
  ]

  return (
    <>
      <PageHead
        title="Leave"
        sub={
          mine
            ? manager
              ? `Your requests and balances · approved by ${manager.n}`
              : 'Your requests and balances'
            : `${waitingOnMe.length} waiting on you · ${pendingAll.length} across the company`
        }
        actions={
          <>
            {subSwitch}
            <Btn onClick={apply}>Apply for leave</Btn>
          </>
        }
      />

      <Kpis>
        {LEAVETYPES.filter((t) => t.annual > 0 || t.k === 'co').map((t) => {
          const b = balance[t.k]
          return (
            <Kpi
              key={t.k}
              title={t.n}
              value={<span className={b.left ? '' : 'warn'}>{b.left}</span>}
              detail={`${b.taken} taken${b.pending ? ` · ${b.pending} pending` : ''}${t.annual ? ` of ${b.earned} earned` : ''}`}
            />
          )
        })}
      </Kpis>
      <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
        Balances are earned minus taken, computed from the requests below — not a number anyone typed
        in. {mine ? '' : 'Shown for you; open a person to see theirs.'}
      </p>

      {!mine && (risky.length || approvedSoon.length) ? (
        <div className="bnr d" style={{ marginTop: 14 }}>
          <span className="bi">⚑</span>
          <div>
            <div className="bt">
              {risky.length + approvedSoon.length} thing
              {risky.length + approvedSoon.length === 1 ? '' : 's'} would leave a department below cover
            </div>
            {risky.length ? (
              <>
                <b>{risky.length} waiting on a decision:</b>{' '}
                {risky.map((l) => `${whoName(l.who)} — ${l.clash?.dep} down to ${l.clash?.left}`).join(' · ')}.
              </>
            ) : null}
            {approvedSoon.length ? (
              <>
                <br />
                <b>{approvedSoon.length} already approved:</b>{' '}
                {approvedSoon.map((x) => `${whoName(x.l.who)} from ${fmtDate(x.l.from)}`).join(' · ')}.
                Worth arranging cover now rather than on the day.
              </>
            ) : null}
            <div className="bs">
              The policy asks for at least {LEAVEPOLICY.minCover} working per department, and is set to “
              {CLASHRULES[LEAVEPOLICY.clashRule][0].toLowerCase()}”.
            </div>
          </div>
          <div className="ba">
            <Btn variant="ghost" small onClick={() => setSub('Policy')}>
              The policy
            </Btn>
          </div>
        </div>
      ) : null}

      {!mine && waitingOnMe.length ? (
        <div className="bnr r" style={{ marginTop: 14 }}>
          <span className="bi">◷</span>
          <div>
            <div className="bt">
              {waitingOnMe.length} request{waitingOnMe.length === 1 ? '' : 's'}{' '}
              {waitingOnMe.length === 1 ? 'is' : 'are'} yours to decide
            </div>
            {reportsToMe.length} people report to you:{' '}
            {reportsToMe.slice(0, 6).map((x) => x.n).join(', ')}
            {reportsToMe.length > 6 ? ' and others' : ''}. Everyone else’s requests are shown too, but
            they belong to another approver.
          </div>
        </div>
      ) : null}

      <div className="fbar" style={{ marginTop: 16 }}>
        {filters.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`pill ${filter === key ? 'on' : ''}`}
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
          >
            {label}
            <span className="n">
              {key === 'all' ? scope.length : scope.filter((l) => l.st === key).length}
            </span>
          </button>
        ))}
      </div>

      {rows.length ? (
        <>
          <Card>
            <div className="tsc">
              <div style={{ minWidth: 900 }}>
                <div className="trow h" style={{ gridTemplateColumns: COLS }}>
                  <span>{mine ? 'Type' : 'Who'}</span>
                  <span>{mine ? 'Dates' : 'Type'}</span>
                  <span>{mine ? 'Reason' : 'Dates'}</span>
                  <span>Days</span>
                  <span>{mine ? 'Status' : 'Reason'}</span>
                  <span>Decision</span>
                </div>
                <div className="tb">
                  {rows.slice(0, PAGE).map((l) => {
                    const t = LEAVETYPES.find((x) => x.k === l.type)
                    const chip = t ? <Chip kind={t.c}>{t.n}</Chip> : <Chip>{l.type}</Chip>
                    const owner = STAFF.find((x) => x.id === l.who)
                    const approver = managerOf(owner)
                    return (
                      <div className="trow" style={{ gridTemplateColumns: COLS }} key={l.id}>
                        <div className="cell">
                          {mine ? (
                            chip
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Avatar name={whoName(l.who)} />
                              <div className="v">{whoName(l.who)}</div>
                            </div>
                          )}
                        </div>
                        <div className="cell">
                          {mine ? (
                            <div className="v mono" style={{ fontSize: '12.5px' }}>
                              {fmtDate(l.from)}
                            </div>
                          ) : (
                            chip
                          )}
                        </div>
                        <div className="cell">
                          <div className="v" style={{ fontSize: '12.5px' }}>
                            {mine ? l.reason : `${fmtDate(l.from)} → ${fmtDate(l.to)}`}
                          </div>
                        </div>
                        <div className="cell">
                          <div className="v mono">{l.days}</div>
                        </div>
                        <div className="cell">
                          {mine ? (
                            <Chip kind={LVSTATUS[l.st][1]}>{LVSTATUS[l.st][0]}</Chip>
                          ) : (
                            <div className="v" style={{ fontSize: '12.5px' }}>
                              {l.reason}
                            </div>
                          )}
                          {l.clash ? (
                            <>
                              <div className="s bad">
                                {l.clash.dep} down to {l.clash.left} of {l.clash.team}
                                {l.clash.who.length ? ` · with ${l.clash.who.join(', ')}` : ''}
                              </div>
                              {l.clash.cover ? <div className="s">They say: {l.clash.cover}</div> : null}
                            </>
                          ) : null}
                          {l.shortNotice !== null && l.shortNotice !== undefined ? (
                            <div className="s warn">
                              {l.shortNotice === 0 ? 'starting today' : `${l.shortNotice} days notice`}
                            </div>
                          ) : null}
                          {l.overBalance ? (
                            <div className="s warn">{r2(l.overBalance)} beyond balance — unpaid</div>
                          ) : null}
                        </div>
                        <div className="cell">
                          {l.st === 'pending' ? (
                            can('assign') ? (
                              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                {approver?.id === me.id ? null : (
                                  <span className="gr" style={{ fontSize: '11.5px' }}>
                                    {approver?.n ?? '—'}
                                  </span>
                                )}
                                <Btn variant="ghost" small onClick={() => decide(l.id, 'rejected')}>
                                  Decline
                                </Btn>
                                <Btn small onClick={() => decide(l.id, 'approved')}>
                                  Approve
                                </Btn>
                              </span>
                            ) : (
                              <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                <Chip kind="r">Awaiting approval</Chip>
                                <Btn variant="ghost" small onClick={() => cancel(l)}>
                                  Cancel
                                </Btn>
                              </span>
                            )
                          ) : l.st === 'approved' && l.who === me.id && l.from > now() ? (
                            <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <Chip kind="v">Approved</Chip>
                              <Btn variant="ghost" small onClick={() => cancel(l)}>
                                Cancel
                              </Btn>
                            </span>
                          ) : (
                            <>
                              <div className="v" style={{ fontSize: '12.5px' }}>
                                <Chip kind={LVSTATUS[l.st][1]}>{LVSTATUS[l.st][0]}</Chip>
                              </div>
                              {l.by ? <div className="s">{l.by}</div> : null}
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </Card>
          {rows.length > PAGE ? (
            <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
              Showing the {PAGE} most recent of {rows.length}.
            </p>
          ) : null}
        </>
      ) : (
        <Card padded>
          <p className="gr" style={{ fontSize: '12.5px', margin: 0 }}>
            Nothing {filter === 'all' ? 'at all' : 'in this state'}.
          </p>
        </Card>
      )}

      <Card padded style={{ marginTop: 18 }}>
        <Label>How each type behaves</Label>
        {LEAVETYPES.map((t) => (
          <div className="rw" key={t.k} style={{ padding: '9px 0' }}>
            <span>
              <Chip kind={t.c}>{t.n}</Chip>
            </span>
            <span>
              <div className="sd">{t.d}</div>
            </span>
            <span className="mono gr" style={{ fontSize: '11.5px' }}>
              {t.annual ? `${t.annual} a year` : 'earned'}
            </span>
          </div>
        ))}
        <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
          Anything taken beyond the balance becomes unpaid leave, and shows on the payslip as a
          deduction rather than disappearing.
        </p>
      </Card>
    </>
  )
}

/* No capability gate: `NAVPERM.leave` is null, so everybody reaches this — the
   screen itself narrows to your own requests when you cannot see the company's. */
export default LeaveScreen

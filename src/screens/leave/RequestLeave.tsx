import { useMemo, useState } from 'react'
import { Btn } from '@/components/ui'
import { LEAVE, LEAVEPOLICY, LEAVETYPES } from '@/data/hrms'
import { leaveBalance } from '@/lib/payroll'
import { leaveCheck, type Note } from '@/lib/leave'
import { whoName } from '@/lib/permissions'
import { now } from '@/lib/clock'
import type { Leave } from '@/data/types'

/**
 * Applying for leave.
 *
 * The form says what the request will mean before it is sent — how much balance
 * would be left, whether it is short notice, and whether it would take the
 * department below cover. That judgement comes from `leaveCheck`, the same call
 * the approver's row is built from, so the applicant and the approver are never
 * shown two different readings of one request.
 */

/** Lengths people actually ask for, rather than a free number. */
const LENGTHS = [1, 2, 3, 4, 5, 7, 10, 14]

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const parseIso = (v: string) => {
  const [y, m, d] = v.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** One of the form's live verdicts, in the banner style that matches its weight. */
function NoteBanner({ note }: { note: Note }) {
  if (note.kind === 'plain') {
    return (
      <div className="gr" style={{ fontSize: '12.5px', marginBottom: 10 }}>
        {note.body}
      </div>
    )
  }
  return (
    <div className={`bnr ${note.kind}`} style={{ margin: '0 0 10px' }}>
      <span className="bi">{note.kind === 'v' ? '✓' : note.kind === 'd' ? '⚑' : '◷'}</span>
      <div>
        {note.title ? <b>{note.title}</b> : null}
        {note.title ? ' ' : null}
        {note.body}
      </div>
    </div>
  )
}

export function ApplyLeave({
  personId,
  onSent,
  onCancel,
}: {
  personId: string
  onSent: (message: string) => void
  onCancel: () => void
}) {
  const balance = leaveBalance(personId)
  const today = now()

  const [type, setType] = useState(LEAVETYPES[0]?.k ?? 'pl')
  const [days, setDays] = useState(1)
  const [from, setFrom] = useState(() =>
    iso(new Date(today.getFullYear(), today.getMonth(), today.getDate() + LEAVEPOLICY.noticeDays)),
  )
  const [reason, setReason] = useState('')
  const [cover, setCover] = useState('')
  const [error, setError] = useState<string | null>(null)

  const start = useMemo(() => (from ? parseIso(from) : today), [from, today])
  const end = useMemo(
    () => new Date(start.getFullYear(), start.getMonth(), start.getDate() + Math.ceil(days) - 1),
    [start, days],
  )
  const check = useMemo(
    () => leaveCheck(personId, type, days, start, end),
    [personId, type, days, start, end],
  )

  const send = () => {
    if (!(days > 0)) return setError('How long?')
    if (check.blocked) {
      return setError(
        `This cannot be sent as it stands. ${check.cover?.dep} would be left below the cover the policy requires. Pick different dates, or agree with someone to swap.`,
      )
    }
    if (check.needReason && !cover.trim()) {
      return setError(
        'Say how the department will manage. It is the question your approver would ask anyway, and answering it here saves a round trip.',
      )
    }
    if (!reason.trim()) {
      return setError('Give a reason. Whoever approves it should not have to guess or ask.')
    }

    const record: Leave = {
      id: `L${9000 + LEAVE.length}`,
      who: personId,
      type,
      from: start,
      to: end,
      days,
      half: days === 0.5,
      st: 'pending',
      reason: reason.trim(),
      by: null,
      at: null,
      clash:
        check.short > 0 && check.cover
          ? {
              dep: check.cover.dep,
              left: check.cover.left,
              team: check.cover.team,
              who: check.clash.map((x) => whoName(x.who)),
              cover: cover.trim(),
            }
          : null,
      shortNotice: check.notice < LEAVEPOLICY.noticeDays ? check.notice : null,
      overBalance: check.overBalance || null,
    }
    LEAVE.unshift(record)
    onSent(
      check.short > 0
        ? 'Sent — the approver is told it leaves the department short'
        : 'Sent for approval',
    )
  }

  return (
    <>
      <div className="frm">
        <div className="fld">
          <label htmlFor="lvT">Type</label>
          <select className="inp" id="lvT" value={type} onChange={(e) => setType(e.target.value)}>
            {LEAVETYPES.map((t) => (
              <option key={t.k} value={t.k}>
                {t.n}
                {t.annual ? ` — ${balance[t.k]?.left ?? 0} left` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="fld">
          <label htmlFor="lvD">How long</label>
          <select
            className="inp"
            id="lvD"
            value={String(days)}
            onChange={(e) => setDays(parseFloat(e.target.value))}
          >
            {LEAVEPOLICY.halfDays ? <option value="0.5">Half day</option> : null}
            {LENGTHS.map((x) => (
              <option key={x} value={x}>
                {x} day{x === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="fld">
        <label htmlFor="lvFrom">Starting</label>
        <input
          className="inp mono"
          id="lvFrom"
          type="date"
          value={from}
          min={iso(today)}
          onChange={(e) => setFrom(e.target.value)}
        />
      </div>

      <div className="fld">
        <label htmlFor="lvR">Reason</label>
        <input
          className="inp"
          id="lvR"
          value={reason}
          placeholder="Enough that whoever approves it does not have to ask"
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      {check.notes.map((n, i) => (
        <NoteBanner key={`${n.kind}-${i}`} note={n} />
      ))}

      {check.needReason ? (
        <div className="fld">
          <label htmlFor="lvC">How will the department manage?</label>
          <input
            className="inp"
            id="lvC"
            value={cover}
            placeholder="Who is covering, or why it can wait"
            onChange={(e) => setCover(e.target.value)}
          />
          <div className="hint">
            Asked because this leaves the department below the agreed cover. It goes to the approver with
            the request.
          </div>
        </div>
      ) : null}

      {error ? (
        <div className="bnr r" style={{ margin: '10px 0 0' }}>
          <span className="bi">⚠</span>
          <div>{error}</div>
        </div>
      ) : null}

      <div className="mf" style={{ marginTop: 16 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn onClick={send} disabled={check.blocked}>
          Send for approval
        </Btn>
      </div>
    </>
  )
}

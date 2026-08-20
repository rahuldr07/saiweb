import { useState } from 'react'
import { Banner, Btn } from '@/components/ui'
import { LEAVEPOLICY, LEAVETYPES } from '@/data/hrms'
import { now } from '@/lib/clock'
import { fmtDate } from '@/lib/format'
import type { Leave } from '@/data/types'

/** Inclusive, so a single day is one day rather than zero. */
const dayCount = (from: Date, to: Date) =>
  Math.round((midnight(to) - midnight(from)) / 86_400_000) + 1

const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()

const parse = (v: string): Date | null => {
  if (!v) return null
  const [y, m, d] = v.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

/** `<input type="date">` wants YYYY-MM-DD regardless of how the app displays dates. */
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/**
 * Asking for leave.
 *
 * The company's own policy decides what is acceptable, so the rules are read
 * from `LEAVEPOLICY` rather than hard-coded here: the notice period and the
 * longest run anyone may take are settings on the Company screen, and a form
 * that disagreed with them would be its own source of truth.
 *
 * Warnings and refusals are kept apart on purpose. Short notice is a thing an
 * approver may accept, so it is said and the request still goes; a run longer
 * than policy allows is not, so it blocks.
 */
export function RequestLeave({
  meId,
  balances,
  onSubmit,
}: {
  meId: string
  balances: Record<string, { left: number }>
  onSubmit: (leave: Leave) => void
}) {
  const today = now()
  const [type, setType] = useState(LEAVETYPES[0].k)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const f = parse(from)
  const t = parse(to)
  const days = f && t && midnight(t) >= midnight(f) ? dayCount(f, t) : 0
  const left = balances[type]?.left ?? 0
  const noticeGiven = f ? Math.round((midnight(f) - midnight(today)) / 86_400_000) : null

  const shortNotice = noticeGiven !== null && noticeGiven < LEAVEPOLICY.noticeDays
  const overRun = days > LEAVEPOLICY.maxConsecutive
  const overBalance = days > left

  const submit = () => {
    if (!f || !t) return setError('Both dates are needed.')
    if (midnight(t) < midnight(f)) return setError('The last day cannot be before the first.')
    if (!reason.trim()) return setError('A reason — it is what the approver decides on.')
    if (overRun)
      return setError(
        `${days} days in a row, and policy allows ${LEAVEPOLICY.maxConsecutive}. Split it into two requests, or have the policy changed on the Company screen.`,
      )
    if (overBalance)
      return setError(
        `That is ${days} day${days === 1 ? '' : 's'} against a balance of ${left}. Choose another type, or shorten it.`,
      )

    onSubmit({
      id: `L${Math.floor(midnight(today) / 1000).toString(36).toUpperCase()}${Math.round(days)}${from.replace(/-/g, '').slice(4)}`,
      who: meId,
      type,
      from: f,
      to: t,
      days,
      st: 'pending',
      reason: reason.trim(),
      by: '',
      at: null,
    })
  }

  return (
    <>
      <div className="frm">
        <div className="fld">
          <label htmlFor="lr-type">Type</label>
          <select className="inp" id="lr-type" value={type} onChange={(e) => setType(e.target.value)}>
            {LEAVETYPES.map((lt) => (
              <option key={lt.k} value={lt.k}>
                {lt.n} — {balances[lt.k]?.left ?? 0} left
              </option>
            ))}
          </select>
          <div className="hint">{LEAVETYPES.find((lt) => lt.k === type)?.d}</div>
        </div>

        <div className="fld">
          <label htmlFor="lr-from">First day</label>
          <input
            className="inp"
            id="lr-from"
            type="date"
            min={iso(today)}
            value={from}
            onChange={(e) => {
              setFrom(e.target.value)
              setError(null)
              /* A one-day request is the common case, so the last day follows the
                 first until it is set to something else. */
              if (!to || (parse(to) && parse(e.target.value) && midnight(parse(to)!) < midnight(parse(e.target.value)!)))
                setTo(e.target.value)
            }}
          />
        </div>

        <div className="fld">
          <label htmlFor="lr-to">Last day</label>
          <input
            className="inp"
            id="lr-to"
            type="date"
            min={from || iso(today)}
            value={to}
            onChange={(e) => {
              setTo(e.target.value)
              setError(null)
            }}
          />
        </div>

        <div className="fld">
          <label>Working out as</label>
          <div className="ro mono">
            {days ? `${days} day${days === 1 ? '' : 's'}` : '—'}
            {days ? ` · ${left - days} left after` : ''}
          </div>
        </div>
      </div>

      <div className="fld" style={{ marginTop: 15 }}>
        <label htmlFor="lr-reason">Reason</label>
        <textarea
          className="inp"
          id="lr-reason"
          placeholder="Family function in Chennai — back on the Monday."
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
            setError(null)
          }}
        />
        <div className="hint">
          Goes to {LEAVEPOLICY.approver === 'manager' ? 'your manager' : 'an administrator'}, who sees this and
          the dates.
        </div>
      </div>

      {shortNotice && !error ? (
        <Banner kind="r" icon="◷" title={`${noticeGiven! < 0 ? 'That date has passed' : `${noticeGiven} days' notice`}`} style={{ marginTop: 16 }}>
          Policy asks for {LEAVEPOLICY.noticeDays}. You can still send it — short notice is the approver's call,
          not the form's.
        </Banner>
      ) : null}

      {error ? (
        <Banner kind="d" icon="⚠" title="Not sent" style={{ marginTop: 16 }}>
          {error}
        </Banner>
      ) : null}

      <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
        <Btn onClick={submit} disabled={!f || !t || !reason.trim()}>
          Send request
        </Btn>
      </div>

      <p className="gr" style={{ fontSize: '11.5px', marginTop: 12 }}>
        {f && t
          ? `${fmtDate(f)} to ${fmtDate(t)}, pending until it is decided.`
          : 'Choose the dates and it will show what they add up to.'}
      </p>
    </>
  )
}

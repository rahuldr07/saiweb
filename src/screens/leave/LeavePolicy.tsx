import { useState } from 'react'
import { Btn, Card, Chip, Label, SectionHead } from '@/components/ui'
import { useUi } from '@/state/ui'
import { useTimeclock } from '@/state/timeclock'
import { LEAVE, LEAVEPOLICY, LEAVETYPES, TIMECFG } from '@/data/hrms'
import { CLASHRULES } from '@/lib/leave'
import type { LeaveType } from '@/data/types'

/**
 * The rules every request is judged against.
 *
 * Editable, and each setting states its consequence rather than only its value —
 * because the interesting question about a policy is never what it is set to, it
 * is what that produces. The panels on the right answer that against the data as
 * it stands, so a change can be read before it is lived with.
 */

const COLS = '190px 110px 110px 120px 1fr 110px'

const r2 = (n: number) => Math.round(n * 100) / 100

/** A number with its unit and the reason it matters. */
function NumberField({
  id,
  label,
  value,
  suffix,
  hint,
  step,
  onChange,
}: {
  id: string
  label: string
  value: number
  suffix?: string
  hint: string
  step?: number
  onChange: (v: number) => void
}) {
  return (
    <div className="fld">
      <label htmlFor={id}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          className="inp mono"
          id={id}
          type="number"
          min={0}
          step={step}
          value={value}
          style={{ width: 100 }}
          onChange={(e) => {
            const n = parseFloat(e.target.value)
            if (n >= 0) onChange(n)
          }}
        />
        {suffix ? (
          <span className="gr" style={{ fontSize: '12.5px' }}>
            {suffix}
          </span>
        ) : null}
      </div>
      <div className="hint">{hint}</div>
    </div>
  )
}

/** A figure the current rules produce, so the setting above can be read in effect. */
function Outcome({ label, value, warn }: { label: string; value: number | string; warn?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '7px 0',
        fontSize: '13.5px',
        borderBottom: '1px solid var(--hair)',
      }}
    >
      <span className="gr">{label}</span>
      <b className={`mono ${warn ? 'warn' : ''}`}>{value}</b>
    </div>
  )
}

export function LeavePolicy({ onChanged }: { onChanged: () => void }) {
  const { toast, openModal, closeModal } = useUi()
  const clock = useTimeclock()
  const [, force] = useState(0)

  const bump = () => {
    force((n) => n + 1)
    onChanged()
  }

  const setPolicy = <K extends keyof typeof LEAVEPOLICY>(k: K, v: (typeof LEAVEPOLICY)[K]) => {
    LEAVEPOLICY[k] = v
    bump()
  }

  const setTime = <K extends keyof typeof TIMECFG>(k: K, v: (typeof TIMECFG)[K]) => {
    TIMECFG[k] = v
    bump()
  }

  /** Add or retype a leave type. A type in use keeps its key so history holds. */
  const editType = (existing?: LeaveType) => {
    const held: LeaveType = existing
      ? { ...existing }
      : { k: '', n: '', annual: 0, carry: 0, enc: false, c: 'n', d: '' }
    const save = () => {
      if (!held.n.trim()) {
        toast('A type needs a name')
        return
      }
      if (existing) {
        Object.assign(existing, held)
      } else {
        const key = held.n.trim().toLowerCase().replace(/[^a-z]/g, '').slice(0, 4) || `t${LEAVETYPES.length}`
        if (LEAVETYPES.some((t) => t.k === key)) {
          toast('That name is too close to an existing type')
          return
        }
        LEAVETYPES.push({ ...held, k: key })
      }
      closeModal()
      bump()
      toast(existing ? `${held.n} saved` : `${held.n} added`)
    }
    openModal({
      title: existing ? `Edit ${existing.n}` : 'Add a leave type',
      body: <TypeFields initial={held} onChange={(d) => Object.assign(held, d)} />,
      footer: (
        <>
          <Btn variant="ghost" onClick={closeModal}>
            Cancel
          </Btn>
          <Btn onClick={save}>{existing ? 'Save type' : 'Add type'}</Btn>
        </>
      ),
    })
  }

  const removeType = (t: LeaveType) => {
    const i = LEAVETYPES.findIndex((x) => x.k === t.k)
    if (i < 0) return
    LEAVETYPES.splice(i, 1)
    bump()
    toast(`${t.n} removed`)
  }

  const openLate = clock.late.filter((x) => !x.waived)
  const latePeople = new Set(openLate.map((x) => x.who))
  const lateRepeat = [...latePeople].filter((id) => openLate.filter((x) => x.who === id).length >= 3)
  const otClaims = clock.overtime.filter((o) => o.st !== 'rejected')
  const otPending = clock.overtime.filter((o) => o.st === 'pending')

  return (
    <>
      <Card>
        <div className="ch">
          <h2>Leave types</h2>
          <div className="r">
            <Btn small onClick={() => editType()}>
              ＋ Add a type
            </Btn>
          </div>
        </div>
        <div className="tsc">
          <div style={{ minWidth: 900 }}>
            <div className="trow h" style={{ gridTemplateColumns: COLS }}>
              <span>Type</span>
              <span>Days a year</span>
              <span>Carries over</span>
              <span>Encashable</span>
              <span>How it behaves</span>
              <span />
            </div>
            <div className="tb">
              {LEAVETYPES.map((t) => {
                const inUse = LEAVE.some((l) => l.type === t.k)
                return (
                  <div className="trow" style={{ gridTemplateColumns: COLS }} key={t.k}>
                    <div className="cell">
                      <Chip kind={t.c}>{t.n}</Chip>
                    </div>
                    <div className="cell">
                      <div className="v mono">{t.annual || '—'}</div>
                      <div className="s gr">{t.annual ? `${r2(t.annual / 12)} a month` : 'earned'}</div>
                    </div>
                    <div className="cell">
                      <div className={`v mono ${t.carry ? '' : 'gr'}`}>{t.carry || 'none'}</div>
                    </div>
                    <div className="cell">
                      {t.enc ? <Chip kind="v">Yes</Chip> : <span className="gr">No</span>}
                    </div>
                    <div className="cell">
                      <div className="v gr" style={{ fontSize: '12.5px' }}>
                        {t.d}
                      </div>
                    </div>
                    <div className="cell">
                      <span style={{ display: 'flex', gap: 6 }}>
                        <Btn variant="ghost" small onClick={() => editType(t)}>
                          Edit
                        </Btn>
                        {inUse ? null : (
                          <Btn variant="danger" small onClick={() => removeType(t)}>
                            Remove
                          </Btn>
                        )}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Card>
      <p className="gr" style={{ fontSize: '12.5px', marginTop: 10 }}>
        Changing a quota changes everyone’s balance from now, because a balance is earned minus taken
        rather than a stored number. A type somebody has already used cannot be removed — the history
        would stop making sense.
      </p>

      <div className="two" style={{ marginTop: 18 }}>
        <Card padded>
          <Label>When somebody applies</Label>
          <div className="frm">
            <NumberField
              id="lp-noticeDays"
              label="Notice normally expected"
              value={LEAVEPOLICY.noticeDays}
              suffix="days ahead"
              hint="A request inside this is allowed, but flagged to the approver so it is a decision rather than a surprise."
              onChange={(v) => setPolicy('noticeDays', v)}
            />
            <NumberField
              id="lp-maxConsecutive"
              label="Longest single request"
              value={LEAVEPOLICY.maxConsecutive}
              suffix="days"
              hint="Beyond this the form says it needs a conversation, not just an approval."
              onChange={(v) => setPolicy('maxConsecutive', v)}
            />
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: '13.5px',
              padding: '11px 13px',
              border: '1px solid var(--hair)',
              borderRadius: 9,
              marginTop: 12,
            }}
          >
            <input
              type="checkbox"
              checked={LEAVEPOLICY.halfDays}
              onChange={(e) => setPolicy('halfDays', e.target.checked)}
            />
            <span>
              <b>Allow half days</b>
              <div className="sd gr">Without them people take a whole day they did not need.</div>
            </span>
          </label>
        </Card>

        <Card padded>
          <Label>When it would leave a department short</Label>
          <NumberField
            id="lp-minCover"
            label="People who must stay working"
            value={LEAVEPOLICY.minCover}
            suffix="at least"
            hint="Counted across the department for every day of the request."
            onChange={(v) => setPolicy('minCover', v)}
          />
          <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
            {Object.entries(CLASHRULES).map(([k, v]) => {
              const on = LEAVEPOLICY.clashRule === k
              return (
                <label
                  key={k}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    fontSize: '13.5px',
                    padding: '11px 13px',
                    border: `1px solid ${on ? 'var(--brand)' : 'var(--hair)'}`,
                    borderRadius: 9,
                    background: on ? 'var(--brandsoft)' : 'var(--card)',
                  }}
                >
                  <input
                    type="radio"
                    name="clashrule"
                    checked={on}
                    onChange={() => setPolicy('clashRule', k)}
                    style={{ marginTop: 2 }}
                  />
                  <span>
                    <b>{v[0]}</b>
                    <div className="sd gr">{v[1]}</div>
                  </span>
                </label>
              )
            })}
          </div>
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            Blocking outright is the strictest and the most likely to be worked around — somebody will
            simply not record the day. “Ask for a reason” keeps the record honest and still puts the
            decision in front of the approver.
          </p>
        </Card>
      </div>

      <SectionHead>Late logins</SectionHead>
      <div className="two">
        <Card padded>
          <Label>When a punch counts as late</Label>
          <div className="frm">
            <NumberField
              id="late-grace"
              label="Grace after the shift start"
              value={TIMECFG.lateGraceMins}
              suffix="minutes"
              step={5}
              hint="A punch inside the grace period is not recorded as late at all. Zero is allowed, and it is a harsher rule than most people expect — a commute is not a decision."
              onChange={(v) => setTime('lateGraceMins', v)}
            />
          </div>
        </Card>
        <Card padded>
          <Label>What that rule produces right now</Label>
          <Outcome label="Late marks in the last 30 days" value={openLate.length} />
          <Outcome label="People affected" value={latePeople.size} />
          <Outcome label="Repeatedly late" value={lateRepeat.length} warn={!!lateRepeat.length} />
          <Outcome label="Waived" value={clock.late.filter((x) => x.waived).length} />
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            Widening the grace period does not erase anything already recorded — it changes what gets
            recorded from here. The log is under <b>Attendance → Late logins</b>.
          </p>
        </Card>
      </div>

      <SectionHead>Overtime</SectionHead>
      <div className="two">
        <Card padded>
          <Label>How it is paid</Label>
          <div className="frm">
            <NumberField
              id="ot-rate"
              label="Rate"
              value={TIMECFG.otRate}
              suffix="× the ordinary hourly rate"
              step={0.25}
              hint="Worked out from each person's own salary, so it follows a raise without anyone updating a table."
              onChange={(v) => setTime('otRate', v)}
            />
            <NumberField
              id="ot-after"
              label="Counts as overtime after"
              value={TIMECFG.otAfterMins}
              suffix={`minutes in a day — ${r2(TIMECFG.otAfterMins / 60)} hours`}
              step={30}
              hint="Measured on the punches, after breaks are taken off."
              onChange={(v) => setTime('otAfterMins', v)}
            />
            <NumberField
              id="ot-cap"
              label="Most in a month"
              value={TIMECFG.otMonthlyCapMins}
              suffix={`minutes — ${r2(TIMECFG.otMonthlyCapMins / 60)} hours`}
              step={60}
              hint="A cap protects the person as much as the budget. Beyond it the claim is flagged rather than refused, because the work was still done."
              onChange={(v) => setTime('otMonthlyCapMins', v)}
            />
          </div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: '13.5px',
              padding: '11px 13px',
              border: '1px solid var(--hair)',
              borderRadius: 9,
              marginTop: 12,
            }}
          >
            <input
              type="checkbox"
              checked={TIMECFG.otNeedsApproval}
              onChange={(e) => setTime('otNeedsApproval', e.target.checked)}
            />
            <span>
              <b>Overtime must be approved before it is paid</b>
              <div className="sd gr">
                {TIMECFG.otNeedsApproval ? (
                  'A claim waits for a decision and reaches the payslip only once approved.'
                ) : (
                  <span className="warn">
                    Off — every claim is paid as submitted. That is a lot of trust to put in a form.
                  </span>
                )}
              </div>
            </span>
          </label>
        </Card>
        <Card padded>
          <Label>What the rules produce right now</Label>
          <Outcome label="Claims this year" value={otClaims.length} />
          <Outcome label="Awaiting a decision" value={otPending.length} warn={!!otPending.length} />
          <Outcome
            label="Approved so far"
            value={clock.overtime.filter((o) => o.st === 'approved').length}
          />
          <p className="gr" style={{ fontSize: '12.5px', marginTop: 12 }}>
            Changing the rate above moves what overtime costs for everyone at once. It is worth seeing
            before you save it.
          </p>
        </Card>
      </div>
    </>
  )
}

/** The type editor's fields, holding their own state so nothing is mutated in JSX. */
function TypeFields({
  initial,
  onChange,
}: {
  initial: LeaveType
  onChange: (d: LeaveType) => void
}) {
  const [d, setD] = useState(initial)
  const upd = (patch: Partial<LeaveType>) => {
    const next = { ...d, ...patch }
    setD(next)
    onChange(next)
  }
  return (
    <>
      <div className="frm">
        <div className="fld" style={{ gridColumn: '1/-1' }}>
          <label htmlFor="lt-n">Name</label>
          <input className="inp" id="lt-n" value={d.n} onChange={(e) => upd({ n: e.target.value })} />
        </div>
        <div className="fld">
          <label htmlFor="lt-a">Days a year</label>
          <input
            className="inp mono"
            id="lt-a"
            type="number"
            min={0}
            value={d.annual}
            onChange={(e) => upd({ annual: Number(e.target.value) || 0 })}
          />
          <div className="hint">Zero means it is earned rather than granted, like comp-off.</div>
        </div>
        <div className="fld">
          <label htmlFor="lt-c">Carries over</label>
          <input
            className="inp mono"
            id="lt-c"
            type="number"
            min={0}
            value={d.carry}
            onChange={(e) => upd({ carry: Number(e.target.value) || 0 })}
          />
        </div>
      </div>
      <div className="fld">
        <label htmlFor="lt-d">How it behaves</label>
        <input
          className="inp"
          id="lt-d"
          value={d.d}
          placeholder="What somebody reading the balance needs to know"
          onChange={(e) => upd({ d: e.target.value })}
        />
      </div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: '13.5px', marginTop: 12 }}>
        <input type="checkbox" checked={!!d.enc} onChange={(e) => upd({ enc: e.target.checked })} />{' '}
        Encashable when somebody leaves
      </label>
    </>
  )
}

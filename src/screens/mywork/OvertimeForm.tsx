import { useState } from 'react'
import { Banner, Btn, Field, Form, FormActions } from '@/components/ui'
import { TIMECFG } from '@/data/hrms'
import { hm } from '@/lib/timeclock'
import { fmtDate } from '@/lib/format'
import { now } from '@/lib/clock'

const MIN_MINUTES = 15

/**
 * Claiming overtime.
 *
 * The minutes are pre-filled from what the punches actually show, so the common
 * case is one click — and a claim that disagrees with the clock is visible to
 * the person making it before it reaches an approver.
 *
 * The reason is required for a stated purpose: overtime with none is impossible
 * to argue for at budget time, and impossible to refuse fairly.
 */
export function OvertimeForm({
  workedMins,
  onCancel,
  onSubmit,
}: {
  /** Minutes worked today after breaks, or 0 if the day is not closed. */
  workedMins: number
  onCancel: () => void
  onSubmit: (date: string, minutes: number, why: string) => void
}) {
  const over = Math.max(0, workedMins - TIMECFG.otAfterMins)
  const [date, setDate] = useState(fmtDate(now()))
  const [minutes, setMinutes] = useState(String(over || 60))
  const [why, setWhy] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const n = parseInt(minutes, 10) || 0
    const reason = why.trim()
    if (n < MIN_MINUTES || !reason) {
      return setError('At least fifteen minutes, and a reason.')
    }
    onSubmit(date.trim(), n, reason)
  }

  return (
    <>
      <Form>
        <Field label="Date">
          <input
            className="inp mono"
            aria-label="Date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
        <Field label="Minutes">
          <input
            className="inp mono"
            aria-label="Minutes"
            type="number"
            min={MIN_MINUTES}
            max={480}
            step={15}
            value={minutes}
            onChange={(e) => {
              setMinutes(e.target.value)
              setError(null)
            }}
          />
        </Field>
      </Form>

      <Field
        label="Why it was needed"
        hint="Overtime with no reason is impossible to argue for at budget time, and impossible to refuse fairly."
      >
        <textarea
          className="inp"
          aria-label="Why it was needed"
          rows={3}
          placeholder="What would not have been done otherwise"
          value={why}
          onChange={(e) => {
            setWhy(e.target.value)
            setError(null)
          }}
        />
      </Field>

      {over ? (
        <Banner kind="b" icon="◔" style={{ marginTop: 10 }}>
          Your punches today show {hm(workedMins)} worked against a{' '}
          {TIMECFG.otAfterMins / 60}-hour day — {hm(over)} over.
        </Banner>
      ) : null}

      {error ? (
        <Banner kind="r" icon="⚠" style={{ margin: '10px 0 0' }}>
          {error}
        </Banner>
      ) : null}

      <FormActions>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn onClick={submit}>Send for approval</Btn>
      </FormActions>
    </>
  )
}

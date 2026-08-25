import { useState } from 'react'
import { Banner, Btn, Field, Form } from '@/components/ui'
import { shiftOf } from '@/lib/timeclock'
import { fmtDate } from '@/lib/format'
import { now } from '@/lib/clock'
import type { Person } from '@/data/types'

/**
 * Asking a colleague to take a day.
 *
 * It goes to a manager because it changes who is covering that day, not because
 * anyone doubts the two people involved — which the banner says, so the approval
 * step does not read as suspicion.
 */
export function SwapForm({
  peers,
  onCancel,
  onSubmit,
}: {
  peers: Person[]
  onCancel: () => void
  onSubmit: (to: string, date: string, why: string) => void
}) {
  const soon = new Date(now().getFullYear(), now().getMonth(), now().getDate() + 4)
  const [date, setDate] = useState(fmtDate(soon))
  const [to, setTo] = useState(peers[0]?.id ?? '')
  const [why, setWhy] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const reason = why.trim()
    if (!date.trim()) return setError('Which day is being swapped.')
    if (!reason) return setError('A reason — it is what the approver is deciding on.')
    onSubmit(to, date.trim(), reason)
  }

  return (
    <>
      <Form>
        <Field label="Which day">
          <input
            className="inp mono"
            aria-label="Which day"
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              setError(null)
            }}
          />
        </Field>
        <Field label="Who">
          <select
            className="inp"
            aria-label="Who"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          >
            {peers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.n} — {shiftOf(p).n}
              </option>
            ))}
          </select>
        </Field>
      </Form>

      <Field label="Why">
        <input
          className="inp"
          aria-label="Why"
          placeholder="Enough for whoever approves it"
          value={why}
          onChange={(e) => {
            setWhy(e.target.value)
            setError(null)
          }}
        />
      </Field>

      <Banner kind="b" icon="⇄" style={{ marginTop: 10 }}>
        Agree it with them first. This sends it to your manager for approval, because it changes who
        is covering that day — not because anyone doubts you.
      </Banner>

      {error ? (
        <Banner kind="r" icon="⚠" style={{ margin: '10px 0 0' }}>
          {error}
        </Banner>
      ) : null}

      <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn onClick={submit}>Send</Btn>
      </div>
    </>
  )
}

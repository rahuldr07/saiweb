import { useState } from 'react'
import { Banner, Btn } from '@/components/ui'
import type { PettyCount } from '@/data/types'
import { inr } from '@/lib/payroll'
import { now } from '@/lib/clock'

/**
 * Counting the box.
 *
 * The expected figure is deliberately not shown until something has been typed:
 * a count that starts from the number it is meant to prove is not a count. Once
 * a figure is in, the difference is stated plainly — and it is recorded as
 * counted, because correcting a count to match the book is how a discrepancy
 * becomes permanent.
 */
export function CountForm({
  expected,
  countedBy,
  onSubmit,
  onCancel,
}: {
  expected: number
  countedBy: string
  onSubmit: (count: Omit<PettyCount, 'id'>) => void
  onCancel: () => void
}) {
  const [counted, setCounted] = useState('')
  const [note, setNote] = useState('')

  const value = Number(counted)
  const entered = counted.trim() !== '' && Number.isFinite(value)
  const drift = value - expected

  const submit = () => {
    if (!entered || value < 0) return
    onSubmit({
      d: now(),
      by: countedBy,
      counted: value,
      note: note.trim() || (drift === 0 ? 'Matched.' : 'Difference not yet explained.'),
    })
  }

  return (
    <>
      <p style={{ fontSize: '13.5px' }}>
        Count the cash physically, then type what is actually there.{' '}
        <b>Do not look at the ledger figure first</b> — a count that starts from the expected number
        is not a count.
      </p>

      <div className="fld">
        <label htmlFor="ct-a">Counted</label>
        <input
          className="inp mono"
          id="ct-a"
          type="number"
          min={0}
          placeholder="0"
          autoComplete="off"
          value={counted}
          onChange={(e) => setCounted(e.target.value)}
        />
      </div>

      <div className="fld">
        <label htmlFor="ct-n">Note</label>
        <input
          className="inp"
          id="ct-n"
          placeholder="Anything worth recording"
          autoComplete="off"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {entered ? (
        drift === 0 ? (
          <Banner kind="v" icon="✓" style={{ margin: 0 }}>
            Matches the ledger exactly at {inr(expected)}.
          </Banner>
        ) : (
          <Banner kind="d" icon="⚑" style={{ margin: 0 }}>
            <b>
              {drift > 0 ? 'Over' : 'Short'} by {inr(Math.abs(drift))}
            </b>{' '}
            — the ledger says {inr(expected)}, you counted {inr(value)}. Record it as counted.
            Correcting the count to match the book is how a discrepancy becomes permanent.
          </Banner>
        )
      ) : null}

      <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn onClick={submit} disabled={!entered || value < 0}>
          Record the count
        </Btn>
      </div>
    </>
  )
}

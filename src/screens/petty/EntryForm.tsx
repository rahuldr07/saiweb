import { useState } from 'react'
import { Banner, Btn, Form } from '@/components/ui'
import { STAFF } from '@/data/people'
import type { PettyConfig, PettyEntry } from '@/data/types'
import { inr } from '@/lib/payroll'
import { now } from '@/lib/clock'

/**
 * Recording money in or out of the box.
 *
 * The arithmetic is worked out on screen as it is typed, so the balance after
 * an entry is never carried in anyone's head — and so an entry that would take
 * the box below zero is visible before it is saved rather than after.
 *
 * A voucher number is required on the way out. Cash paid out with nothing to
 * show for it is the entry nobody can explain three months later; writing
 * "none" is allowed, and flags the row rather than hiding it.
 */
export function EntryForm({
  balance,
  cfg,
  onSubmit,
  onCancel,
}: {
  balance: number
  cfg: PettyConfig
  onSubmit: (entry: Omit<PettyEntry, 'id'>) => void
  onCancel: () => void
}) {
  const people = STAFF.filter((s) => s.active !== false)
  const [kind, setKind] = useState<'debit' | 'credit'>('debit')
  const [amount, setAmount] = useState('')
  const [what, setWhat] = useState('')
  const [by, setBy] = useState(people[0]?.n ?? '')
  const [ref, setRef] = useState('')
  const [error, setError] = useState<string | null>(null)

  const amt = Number(amount) || 0
  const after = kind === 'credit' ? balance + amt : balance - amt

  const change = <T,>(set: (v: T) => void) => (v: T) => {
    set(v)
    setError(null)
  }

  const submit = () => {
    if (!(amt > 0) || !what.trim()) return setError('An amount and what it was for.')
    if (kind === 'debit' && balance - amt < 0)
      return setError('The box does not hold that much. Record the top-up first.')
    if (kind === 'debit' && !ref.trim())
      return setError(
        'A receipt or voucher number. Cash out with nothing to show for it is the entry nobody can explain three months later. If there genuinely is no receipt, write “none” and it will be flagged rather than hidden.',
      )

    onSubmit({
      d: now(),
      kind,
      what: what.trim(),
      amt,
      by,
      ref: ref.trim() || '—',
      receipt: !!ref.trim() && ref.trim().toLowerCase() !== 'none',
    })
  }

  return (
    <>
      <Form>
        <div className="fld">
          <label htmlFor="pe-k">Money in or out</label>
          <select
            className="inp"
            id="pe-k"
            value={kind}
            onChange={(e) => change(setKind)(e.target.value as 'debit' | 'credit')}
          >
            <option value="debit">Paid out — debit</option>
            <option value="credit">Put in — credit</option>
          </select>
        </div>
        <div className="fld">
          <label htmlFor="pe-a">Amount</label>
          <input
            className="inp mono"
            id="pe-a"
            type="number"
            min={1}
            step={1}
            placeholder="1240"
            value={amount}
            onChange={(e) => change(setAmount)(e.target.value)}
          />
        </div>
      </Form>

      <div className="fld">
        <label htmlFor="pe-w">What for</label>
        <input
          className="inp"
          id="pe-w"
          placeholder="County copy fees — Cambria"
          autoComplete="off"
          value={what}
          onChange={(e) => change(setWhat)(e.target.value)}
        />
      </div>

      <Form>
        <div className="fld">
          <label htmlFor="pe-b">Who took it</label>
          <select className="inp" id="pe-b" value={by} onChange={(e) => setBy(e.target.value)}>
            {people.map((p) => (
              <option key={p.id} value={p.n}>
                {p.n}
              </option>
            ))}
          </select>
        </div>
        <div className="fld">
          <label htmlFor="pe-r">Receipt or voucher number</label>
          <input
            className="inp mono"
            id="pe-r"
            placeholder="CM-8841"
            autoComplete="off"
            value={ref}
            onChange={(e) => change(setRef)(e.target.value)}
          />
        </div>
      </Form>

      {/* The sum, worked out here so it is never carried in anyone's head. */}
      <div
        className="rw"
        style={{ background: 'var(--tint)', borderRadius: 9, padding: '12px 14px', marginTop: 6 }}
      >
        <span className="gr">=</span>
        <span>
          <b>
            {inr(balance)} {kind === 'credit' ? '+' : '−'} {inr(amt)} = {inr(after)}
          </b>
          <div className="sd gr">
            The balance after this entry. Worked out here so it is never carried in anyone’s head.
          </div>
        </span>
        <span />
      </div>

      {after < 0 ? (
        <Banner kind="d" icon="⚑" style={{ margin: '10px 0 0' }}>
          <b>That would take the box below zero.</b> Either the float needs topping up first, or an
          earlier entry is wrong.
        </Banner>
      ) : null}

      {kind === 'debit' && amt > cfg.limit ? (
        <Banner kind="r" icon="⚠" style={{ margin: '10px 0 0' }}>
          Above the {inr(cfg.limit)} cash ceiling. This should go by bank transfer against an
          invoice, so there is a second record of it.
        </Banner>
      ) : null}

      {error ? (
        <Banner kind="r" icon="⚠" style={{ margin: '10px 0 0' }}>
          {error}
        </Banner>
      ) : null}

      <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn onClick={submit}>Record it</Btn>
      </div>
    </>
  )
}

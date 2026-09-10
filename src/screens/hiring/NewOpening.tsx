import { useState } from 'react'
import { Banner, Btn, FormActions } from '@/components/ui'
import { DEPTLIST } from '@/data/org'
import { STAFF } from '@/data/people'
import { useBoard } from '@/state/hiring'
import { now } from '@/lib/clock'
import { fmtDate } from '@/lib/format'
import type { Opening } from '@/data/types'

const TYPES = ['Full time', 'Part time', 'Contract', 'Intern'] as const

export function NewOpening({
  raisedBy,
  onSubmit,
  onCancel,
}: {
  raisedBy: string
  onSubmit: (opening: Opening) => void
  onCancel?: () => void
}) {
  const [title, setTitle] = useState('')
  const [dep, setDep] = useState(DEPTLIST[0].n)
  const [seats, setSeats] = useState('1')
  const [type, setType] = useState<string>(TYPES[0])
  const [why, setWhy] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { openings } = useBoard()

  const n = Number(seats)
  const inDept = STAFF.filter((s) => s.dep.includes(dep) && s.active !== false).length

  const submit = () => {
    if (!title.trim()) return setError('A title — it is what a candidate applies to.')
    if (!Number.isInteger(n) || n < 1) return setError('At least one seat.')
    if (n > 50) return setError(`${n} seats in one opening is almost certainly a typo.`)
    if (!why.trim())
      return setError('The reason. Whoever approves this did not feel the pressure that caused it.')

    const next =
      openings.reduce((max, o) => Math.max(max, Number(o.id.replace(/\D/g, '')) || 0), 0) + 1

    onSubmit({
      id: `J${next}`,
      title: title.trim(),
      dep,
      n,
      type,
      by: raisedBy,
      open: now(),
      why: why.trim(),
    })
  }

  return (
    <>
      <div className="frm">
        <div className="fld" style={{ gridColumn: '1/-1' }}>
          <label htmlFor="no-title">Title</label>
          <input
            className="inp"
            id="no-title"
            placeholder="Title searcher — PA and NJ"
            autoComplete="off"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setError(null)
            }}
          />
          <div className="hint">What a candidate sees, so name the work and the states it covers.</div>
        </div>

        <div className="fld">
          <label htmlFor="no-dep">Department</label>
          <select className="inp" id="no-dep" value={dep} onChange={(e) => setDep(e.target.value)}>
            {DEPTLIST.map((d) => (
              <option key={d.id} value={d.n}>
                {d.n}
              </option>
            ))}
          </select>
          <div className="hint">
            {inDept} {inDept === 1 ? 'person works' : 'people work'} {dep} today.
          </div>
        </div>

        <div className="fld">
          <label htmlFor="no-seats">Seats</label>
          <input
            className="inp mono"
            id="no-seats"
            type="number"
            min={1}
            max={50}
            value={seats}
            onChange={(e) => {
              setSeats(e.target.value)
              setError(null)
            }}
          />
          <div className="hint">
            {n >= 1 && Number.isInteger(n)
              ? `${dep} would go from ${inDept} to ${inDept + n}.`
              : 'How many people this opening is for.'}
          </div>
        </div>

        <div className="fld">
          <label htmlFor="no-type">Employment</label>
          <select className="inp" id="no-type" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="fld">
          <label>Raised by</label>
          <div className="ro">{raisedBy}</div>
        </div>
      </div>

      <div className="fld" style={{ marginTop: 15 }}>
        <label htmlFor="no-why">Why this opening exists</label>
        <textarea
          className="inp"
          id="no-why"
          placeholder="Volume from MGR has grown faster than Search can absorb; this is the department the reports keep flagging."
          value={why}
          onChange={(e) => {
            setWhy(e.target.value)
            setError(null)
          }}
        />
        <div className="hint">
          The case for the headcount. It stays on the opening, so the reason is still there when the approval
          is looked at again.
        </div>
      </div>

      {error ? (
        <Banner kind="d" icon="⚠" title="Not opened" style={{ marginTop: 16 }}>
          {error}
        </Banner>
      ) : null}

      <FormActions>
        {onCancel ? (
          <Btn variant="ghost" onClick={onCancel}>
            Cancel
          </Btn>
        ) : null}
        <Btn onClick={submit} disabled={!title.trim() || !why.trim()}>
          Open the role
        </Btn>
      </FormActions>

      <p className="gr" style={{ fontSize: 'var(--t-label)', marginTop: 12 }}>
        Opens {fmtDate(now())} under {raisedBy}, with no candidates against it yet.
      </p>
    </>
  )
}

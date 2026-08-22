import { useState } from 'react'
import { Banner, Btn } from '@/components/ui'
import { removeStatus, saveStatus, useStatuses } from '@/state/company'

/**
 * One order status: a name and a colour.
 *
 * Colour is never the only signal — the name is shown beside it everywhere — so
 * the picker is a convenience, not an accessibility problem.
 */
export function StatusForm({
  statusKey,
  onCancel,
  onDone,
}: {
  statusKey?: string
  onCancel: () => void
  onDone: (message: string) => void
}) {
  const statuses = useStatuses()
  const cur = statusKey ? statuses.find(([k]) => k === statusKey)?.[1] : null
  const [name, setName] = useState(cur?.[0] ?? '')
  const [colour, setColour] = useState(cur?.[1] ?? '#6366F1')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const n = name.trim()
    if (!n) return setError('A status needs a name.')
    if (statuses.some(([k, v]) => k !== statusKey && v[0].toLowerCase() === n.toLowerCase()))
      return setError(
        `${n} already exists. Two statuses with the same name is how an order ends up in neither.`,
      )
    saveStatus(n, colour, statusKey)
    onDone(statusKey ? `${n} saved` : `${n} added`)
  }

  return (
    <>
      {error ? (
        <Banner kind="r" icon="⚠" style={{ marginBottom: 14 }}>
          {error}
        </Banner>
      ) : null}

      <div className="fld">
        <label htmlFor="stName">Name</label>
        <input
          className="inp"
          id="stName"
          placeholder="e.g. Awaiting county"
          autoComplete="off"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
        />
      </div>

      <div className="fld">
        <label htmlFor="stCol">Colour</label>
        <input
          className="inp"
          id="stCol"
          type="color"
          style={{ width: 90, padding: 4 }}
          value={colour}
          onChange={(e) => setColour(e.target.value)}
        />
        <div className="hint">
          Used on the board and in every status chip. Colour is never the only signal — the name is
          always shown beside it.
        </div>
      </div>

      <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
        <Btn onClick={submit}>{statusKey ? 'Save' : 'Add status'}</Btn>
      </div>
    </>
  )
}

/**
 * Deleting a status.
 *
 * A status live orders point at cannot go — deleting it would leave them
 * pointing at nothing, so the refusal carries the count and a way to see them.
 */
export function StatusDelete({
  statusKey,
  name,
  used,
  onCancel,
  onSee,
  onDone,
}: {
  statusKey: string
  name: string
  used: number
  onCancel: () => void
  onSee: () => void
  onDone: (message: string) => void
}) {
  if (used) {
    return (
      <>
        <p style={{ fontSize: '13.5px' }}>
          <b>
            {used} order{used === 1 ? ' is' : 's are'}
          </b>{' '}
          sitting in {name} right now.
        </p>
        <p className="gr" style={{ fontSize: '12.5px' }}>
          Deleting it would leave {used === 1 ? 'that order' : 'those orders'} pointing at nothing.
          Move {used === 1 ? 'it' : 'them'} first, then delete the status.
        </p>
        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
          <Btn variant="ghost" onClick={onCancel}>
            Close
          </Btn>
          <Btn onClick={onSee}>See {used === 1 ? 'it' : 'them'}</Btn>
        </div>
      </>
    )
  }

  return (
    <>
      <p style={{ fontSize: '13.5px' }}>Nothing is using it, so nothing breaks.</p>
      <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', marginTop: 18 }}>
        <Btn variant="ghost" onClick={onCancel}>
          Keep it
        </Btn>
        <Btn
          variant="danger"
          onClick={() => {
            removeStatus(statusKey)
            onDone(`${name} deleted`)
          }}
        >
          Delete
        </Btn>
      </div>
    </>
  )
}

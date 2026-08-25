import { useState } from 'react'
import { Banner, Btn, Field } from '@/components/ui'
import { UPDKIND } from '@/data/production'
import type { Update } from '@/data/types'

const KINDS = Object.keys(UPDKIND) as Update['kind'][]

/** Enough to be useful to somebody who was not here. */
const MIN_BODY = 12

/**
 * Writing a handover note.
 *
 * The length floor is the only validation, and it is the one that matters: a few
 * words is a note to yourself, not a handover. It is stated as such rather than
 * as "too short", because the reader has to know what would fix it.
 */
export function UpdateForm({
  onCancel,
  onSubmit,
}: {
  onCancel: () => void
  onSubmit: (kind: Update['kind'], body: string) => void
}) {
  const [kind, setKind] = useState<Update['kind']>(KINDS[0])
  const [body, setBody] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = () => {
    const b = body.trim()
    if (b.length < MIN_BODY) {
      return setError(
        'Write enough to be useful to someone who was not here. A few words is a note to yourself, not a handover.',
      )
    }
    onSubmit(kind, b)
  }

  return (
    <>
      <Field
        label="What kind"
        hint="Handover and Blocked are the two anyone else actually reads."
      >
        <select
          className="inp"
          aria-label="What kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as Update['kind'])}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </Field>

      <Field label="What happened">
        <textarea
          className="inp"
          aria-label="What happened"
          rows={4}
          placeholder="Enough that someone picking this up tomorrow does not have to ask you"
          value={body}
          onChange={(e) => {
            setBody(e.target.value)
            setError(null)
          }}
        />
      </Field>

      <Banner kind="b" icon="⚑" style={{ marginTop: 10 }}>
        Once posted this cannot be edited or removed. An update you can quietly change afterwards is
        not a record of anything.
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
        <Btn onClick={submit}>Post it</Btn>
      </div>
    </>
  )
}
